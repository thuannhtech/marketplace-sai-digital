"use server";

import { Auth, Configuration, Me } from "ordercloud-javascript-sdk";

const ORDERCLOUD_IMPERSONATION_ROLES = [
  "BuyerAdmin",
  "BuyerReader",
  "BuyerUserAdmin",
  "BuyerUserReader",
  "BuyerImpersonation",
  "Shopper",
  "AddressAdmin",
  "MeAddressAdmin",
  "MeAdmin",
  "MeCreditCardAdmin",
  "MeXpAdmin",
  "PasswordReset",
  "ShipmentAdmin",
  "ShipmentReader",
  "OrderAdmin",
  "OrderReader",
  "UnsubmittedOrderReader",
  "OverrideUnitPrice",
  "OverrideShipping",
  "CreditCardAdmin",
  "CreditCardReader",
  "ProductAdmin",
  "ProductReader",
  "PromotionReader",
  "PromotionAdmin",
] as const;

const DEFAULT_ORDERCLOUD_SCOPE = ORDERCLOUD_IMPERSONATION_ROLES.join(" ");

function getOrderCloudEnvValue(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }

  return "";
}

export async function getOrderCloudToken() {
  const clientID = getOrderCloudEnvValue("OC_CLIENT_ID", "NEXT_PUBLIC_ORDERCLOUD_CLIENT_ID");
  const username = process.env.ORDERCLOUD_USERNAME || "";
  const password = process.env.ORDERCLOUD_PASSWORD || "";
  const baseApiUrl = getOrderCloudEnvValue("OC_BASE_URL", "NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL") || "https://sandboxapi.ordercloud.io";

  const clientSecret = getOrderCloudEnvValue("OC_CLIENT_SECRET", "ORDERCLOUD_CLIENT_SECRET");

  Configuration.Set({
    baseApiUrl: baseApiUrl,
    clientID,
  });

  try {
    const formData = new URLSearchParams();
    const canUsePasswordGrant = Boolean(username && password);
    formData.append("grant_type", canUsePasswordGrant ? "password" : "client_credentials");
    formData.append("client_id", clientID);
    formData.append("client_secret", clientSecret);

    if (canUsePasswordGrant) {
      formData.append("username", username);
      formData.append("password", password);
      formData.append("scope", "FullAccess");
    } else {
      formData.append("scope", process.env.ORDERCLOUD_TOKEN_SCOPE?.trim() || DEFAULT_ORDERCLOUD_SCOPE);
    }

    const response = await fetch(`${baseApiUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw { response: { data } };
    }

    return { success: true, token: data.access_token };
  } catch (error: any) {
    console.error("OrderCloud Auth Error:", error);
    let errorMsg = error instanceof Error ? error.message : "Unknown Error";
    
    if (error.response?.data) {
      errorMsg = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
    } else if (error.isOrderCloudError && error.errors && error.errors.Errors && error.errors.Errors[0]) {
      errorMsg = error.errors.Errors[0].Message;
    }
    return { success: false, error: `Auth Error: ${errorMsg}` };
  }
}

async function getOrderCloudImpersonationToken(buyerId: string, userId: string) {
  const clientID = getOrderCloudEnvValue("OC_CLIENT_ID", "NEXT_PUBLIC_ORDERCLOUD_CLIENT_ID");
  const clientSecret = getOrderCloudEnvValue("OC_CLIENT_SECRET", "ORDERCLOUD_CLIENT_SECRET");
  const baseApiUrl = getOrderCloudEnvValue("OC_BASE_URL", "NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL") || "https://sandboxapi.ordercloud.io";

  Configuration.Set({
    baseApiUrl,
    clientID,
  });

  const { Users } = await import("ordercloud-javascript-sdk");

  try {
    const buyerAccessToken = await Auth.ClientCredentials(
      clientSecret,
      clientID,
      [...ORDERCLOUD_IMPERSONATION_ROLES],
    );

    const userToken = await Users.GetAccessToken(
      buyerId,
      userId,
      {
        ClientID: clientID,
        Roles: [...ORDERCLOUD_IMPERSONATION_ROLES],
      } as any,
      {
        accessToken: buyerAccessToken.access_token,
      } as any,
    );

    return { success: true, token: userToken.access_token };
  } catch (error: any) {
    console.error("OrderCloud impersonation token error:", error);
    let errorMsg = error instanceof Error ? error.message : "Unknown Error";

    if (error.response?.data) {
      errorMsg = typeof error.response.data === "string" ? error.response.data : JSON.stringify(error.response.data);
    } else if (error.isOrderCloudError && error.errors && error.errors.Errors && error.errors.Errors[0]) {
      errorMsg = error.errors.Errors[0].Message;
    }

    return { success: false, error: `Impersonation Auth Error: ${errorMsg}` };
  }
}

function normalizeMeAddressUsage(useDefaultBilling?: boolean, useDefaultShipping?: boolean) {
  const billing = Boolean(useDefaultBilling);
  const shipping = Boolean(useDefaultShipping);

  if (!billing && !shipping) {
    return { billing: false, shipping: true };
  }

  return { billing, shipping };
}

/** Buyer ID from env — used only to scope incoming orders (`Orders.List` / detail check). */
function resolveOrderCloudBuyerId(): string {
  const raw = getOrderCloudEnvValue("OC_BUYER_ID", "NEXT_PUBLIC_ORDERCLOUD_BUYER_ID", "ORDERCLOUD_BUYER_ID");
  const buyerId = typeof raw === "string" ? raw.trim() : "";
  if (!buyerId) {
    throw new Error("Missing Buyer ID in environment variables");
  }
  return buyerId;
}

function getXpValue(source: unknown, paths: string[], fallback = "N/A"): string {
  const xp = (source as { xp?: Record<string, unknown>; Xp?: Record<string, unknown> } | undefined)?.xp ??
    (source as { Xp?: Record<string, unknown> } | undefined)?.Xp;

  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, xp);

    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value);
    }
  }

  return fallback;
}

function toNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatOcDate(value?: string): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function normalizePurchasedBy(value: string): string {
  return value.trim().toLowerCase() === "buyer anonymous sitecoreai" ? "Anonymous" : value;
}

export interface Report104InventoryRow {
  id: string;
  purchasedBy: string;
  accountManager: string;
  market: string;
  transactionDate: string;
  transactionReceipt: string;
  transactionStatus: string;
  product: string;
  quantityPurchased: number;
  unitCost: number;
  amount: number;
  inventoryBalanceQuantity: number;
  convertedEticketsQuantity: number;
  expiryDate: string;
  validityStatus: string;
}

export interface Report104Summary {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalQuantityPurchased: number;
  totalAmount: number;
  availableInventory: number;
  convertedEtickets: number;
  expiredItems: number;
}

export async function getReport104InventoryData() {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      throw new Error(auth.error || "OrderCloud auth failed");
    }

    const { Buyers, LineItems, Orders, Products, Tokens, Users } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = resolveOrderCloudBuyerId();
    const [buyer, orderList] = await Promise.all([
      Buyers.Get(buyerId).catch(() => null),
      Orders.List("Incoming", {
        buyerID: buyerId,
        pageSize: 25,
        sortBy: ["!DateSubmitted", "!DateCreated"],
      } as any),
    ]);

    const productCache = new Map<string, any>();
    const userCache = new Map<string, any>();

    const rows: Report104InventoryRow[] = [];

    for (const order of orderList.Items ?? []) {
      const lineItems = await LineItems.List("All", order.ID, { pageSize: 100 } as any).catch(() => ({ Items: [] }));
      const userId = order.FromUserID || "";
      let user: any = null;

      if (userId) {
        if (!userCache.has(userId)) {
          userCache.set(userId, await Users.Get(buyerId, userId).catch(() => null));
        }
        user = userCache.get(userId);
      }

      for (const lineItem of lineItems.Items ?? []) {
        const lineItemPayload = lineItem as any;
        const productId = lineItemPayload.ProductID || lineItemPayload.Product?.ID || "";
        let product: any = lineItemPayload.Product || null;

        if (productId) {
          if (!productCache.has(productId)) {
            productCache.set(productId, await Products.Get(productId).catch(() => product));
          }
          product = productCache.get(productId) || product;
        }

        const quantity = toNumber(lineItemPayload.Quantity);
        const unitCost = toNumber(lineItemPayload.UnitPrice ?? product?.PriceSchedule?.PriceBreaks?.[0]?.Price);
        const amount = toNumber(lineItemPayload.LineTotal ?? lineItemPayload.Subtotal) || quantity * unitCost;
        const transactionStatus = String(order.Status || getXpValue(order, ["SubStatus", "PaymentStatus"], "N/A"));
        const expiryDate = getXpValue(lineItem, ["ExpiryDate", "ExpirationDate"], getXpValue(product, ["ExpiryDate", "ExpirationDate"]));
        const validityStatusFromXp = getXpValue(lineItem, ["ValidityStatus"], getXpValue(product, ["ValidityStatus"], ""));
        const validityStatus =
          validityStatusFromXp ||
          (expiryDate !== "N/A" && new Date(expiryDate).getTime() < Date.now() ? "expired" : "available");

        rows.push({
          id: `${order.ID}-${lineItemPayload.ID || productId}`,
          purchasedBy: normalizePurchasedBy(
            [user?.FirstName, user?.LastName].filter(Boolean).join(" ").trim() ||
              [order.FromUser?.FirstName, order.FromUser?.LastName].filter(Boolean).join(" ").trim() ||
              user?.Username ||
              order.FromUser?.Username ||
              buyer?.Name ||
              order.FromCompanyID ||
              buyerId,
          ),
          accountManager: getXpValue(user, ["AccountManager", "PersonalInformation.AccountManager"], getXpValue(order, ["AccountManager"])),
          market: getXpValue(order, ["Market", "Markets"], getXpValue(product, ["Market", "Markets"])),
          transactionDate: formatOcDate(order.DateSubmitted || order.DateCreated),
          transactionReceipt: getXpValue(order, ["TransactionReceipt", "ReceiptNo", "ReceiptNumber"], order.ID || "N/A"),
          transactionStatus,
          product: product?.Name || lineItemPayload.Product?.Name || productId || "N/A",
          quantityPurchased: quantity,
          unitCost,
          amount,
          inventoryBalanceQuantity: toNumber(getXpValue(product, ["InventoryBalanceQuantity", "Inventory.BalanceQuantity", "QuantityAvailable"], product?.Inventory?.QuantityAvailable ?? product?.QuantityAvailable ?? 0)),
          convertedEticketsQuantity: toNumber(getXpValue(lineItem, ["ConvertedEticketsQuantity", "ConvertToEticketsQuantity"], getXpValue(product, ["ConvertedEticketsQuantity", "ConvertToEticketsQuantity"], 0 as any))),
          expiryDate,
          validityStatus,
        });
      }
    }

    const summary: Report104Summary = rows.reduce(
      (acc, row) => {
        const isFailed = /fail|cancel|declin|problem/i.test(row.transactionStatus);
        acc.totalTransactions += 1;
        acc.successfulTransactions += isFailed ? 0 : 1;
        acc.failedTransactions += isFailed ? 1 : 0;
        acc.totalQuantityPurchased += row.quantityPurchased;
        acc.totalAmount += row.amount;
        acc.availableInventory += row.inventoryBalanceQuantity;
        acc.convertedEtickets += row.convertedEticketsQuantity;
        acc.expiredItems += row.validityStatus.toLowerCase() === "expired" ? 1 : 0;
        return acc;
      },
      {
        totalTransactions: 0,
        successfulTransactions: 0,
        failedTransactions: 0,
        totalQuantityPurchased: 0,
        totalAmount: 0,
        availableInventory: 0,
        convertedEtickets: 0,
        expiredItems: 0,
      },
    );

    return {
      success: true,
      data: {
        rows: JSON.parse(JSON.stringify(rows)),
        summary,
        lastSyncUtc: new Date().toISOString(),
      },
    };
  } catch (err: any) {
    console.error("Get Report 104 Inventory Error:", err);
    return { success: false, error: err.message || "Failed to load Report 104 inventory data" };
  }
}

export async function getIncomingOrders() {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      throw new Error(`Không thể đăng nhập OrderCloud: ${auth.error}`);
    }

    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = resolveOrderCloudBuyerId();
    const orders = await Orders.List("Incoming", { buyerID: buyerId });
    
    return { success: true, data: JSON.parse(JSON.stringify(orders.Items)) };
  } catch (error: any) {
    console.error("Fetch Orders Error:", error);
    let errorMsg = error instanceof Error ? error.message : "Unknown Error";
    
    if (error.isOrderCloudError && error.errors && error.errors.Errors && error.errors.Errors[0]) {
      errorMsg = error.errors.Errors[0].Message;
    }
    
    return { success: false, error: `Lỗi khi lấy danh sách đơn hàng: ${errorMsg}` };
  }
}

export async function getOrderDetail(orderId: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      throw new Error(`Không thể đăng nhập OrderCloud: ${auth.error}`);
    }

    const { Orders, Tokens, LineItems, Me, Payments, CreditCards } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = resolveOrderCloudBuyerId();
    const order = await Orders.Get("Incoming", orderId);
    if (order.FromCompanyID !== buyerId) {
      return { success: false, error: "Order not found or does not belong to this buyer." };
    }

    const [lineItemsRes, promotionsRes, paymentsRes] = await Promise.all([
      LineItems.List("All", orderId).catch(() => ({ Items: [] })),
      Orders.ListPromotions("Incoming", orderId).catch(() => ({ Items: [] })),
      Payments.List("All", orderId).catch(() => ({ Items: [] }))
    ]);

    const impersonationAuth = order.FromUserID
      ? await getOrderCloudImpersonationToken(order.FromCompanyID, order.FromUserID)
      : { success: false, error: "Order is missing FromUserID." };

    let shippingAddress = null;
    if (order.ShippingAddressID && impersonationAuth.success && impersonationAuth.token) {
      try {
        shippingAddress = await Me.GetAddress(order.ShippingAddressID, {
          accessToken: impersonationAuth.token,
        } as any);
      } catch (err) {
        console.error("Failed to fetch Shipping Address using Me.GetAddress", err);
      }
    }

    console.log('shippingAddress', shippingAddress)

    let paymentInfo: any = {
      Provider: "N/A",
      Method: "N/A",
      Status: order.xp?.PaymentStatus || "N/A",
      TransactionRefID: "N/A",
      CardNumber: "N/A",
      Currency: order.Currency || "USD"
    };

    if (paymentsRes.Items && paymentsRes.Items.length > 0) {
      const payment = paymentsRes.Items[0];
      paymentInfo.Method = payment.Type;
      
      if (payment.Transactions && payment.Transactions.length > 0) {
        const transaction = payment.Transactions[0];
        paymentInfo.TransactionRefID = transaction.ID;
        paymentInfo.Provider = transaction.xp?.Provider || payment.xp?.Provider || "Braintree";
        if (transaction.ResultCode || transaction.ResultMessage) {
          paymentInfo.Status = transaction.ResultCode === "Authorized" ? "PAID" : transaction.ResultCode || paymentInfo.Status;
        }
      }

      if (payment.CreditCardID) {
        try {
          let card = null;
          try {
            if (impersonationAuth.success && impersonationAuth.token) {
              card = await Me.GetCreditCard(payment.CreditCardID, {
                accessToken: impersonationAuth.token,
              } as any);
            }
          } catch(e) {
             if (order.FromCompanyID) {
                card = await CreditCards.Get(order.FromCompanyID, payment.CreditCardID);
             }
          }
          if (card) {
            paymentInfo.CardNumber = card.PartialAccountNumber || card.Token || "N/A";
          }
        } catch (err) {
          console.error("Failed to fetch Credit Card", err);
        }
      }
    }

    const promoItems: any[] = (promotionsRes as any).Items || [];

    const resultData = {
      ...order,
      LineItems: lineItemsRes.Items,
      AppliedPromotions: promoItems,
      ResolvedShippingAddress: shippingAddress,
      PaymentInfo: paymentInfo
    };

    return { success: true, data: JSON.parse(JSON.stringify(resultData)) };
  } catch (error: any) {
    console.error("Fetch Order Detail Error:", error);
    let errorMsg = error instanceof Error ? error.message : "Unknown Error";
    if (error.isOrderCloudError && error.errors && error.errors.Errors && error.errors.Errors[0]) {
      errorMsg = error.errors.Errors[0].Message;
    }
    return { success: false, error: `Lỗi khi lấy chi tiết đơn hàng: ${errorMsg}` };
  }
}

export async function cancelOrderAction(orderId: string, reason: string, details: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);
  
    try {
      await Orders.Cancel("Incoming", orderId);
    } catch (e) {
      console.warn("OrderCloud Cancel failed, proceeding to patch xp anyway", e);
    }

    await Orders.Patch("Incoming", orderId, {
      xp: {
        SubStatus: "CANCELLED",
        CancelReason: reason,
        CancelReasonDetail: details,
        LastUpdated: new Date().toISOString()
      }
    });
    
    return { success: true };
  } catch (err: any) {
    console.error("Cancel Error:", err);
    return { success: false, error: err.message || "Failed to cancel order" };
  }
}

export async function confirmOrderAction(orderId: string, sapSaleOrderID: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    await Orders.Patch("Incoming", orderId, {
      xp: {
        SubStatus: "CONFIRMED",
        SAPSaleOrderID: sapSaleOrderID,
        LastUpdated: new Date().toISOString()
      }
    });
    return { success: true };
  } catch (err: any) {
    console.error("Confirm Error:", err);
    return { success: false, error: err.message || "Failed to confirm order" };
  }
}

export async function completeOrderAction(orderId: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);
    await Orders.Complete("Incoming", orderId);
    return { success: true };
  } catch (err: any) {
    console.error("Complete Error:", err);
    return { success: false, error: err.message || "Failed to complete order" };
  }
}

export async function updateOrderAction(orderId: string, payload: any) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    await Orders.Patch("Incoming", orderId, payload);
    return { success: true };
  } catch (err: any) {
    console.error("Update Error:", err);
    return { success: false, error: err.message || "Failed to update order" };
  }
}

export async function getCustomers(page = 1, pageSize = 20, search?: string, filters?: any) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Users, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    // OrderCloud Users.List is always scoped to a buyer: /buyers/{buyerID}/users
    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    // Clean up empty filters
    const validFilters: any = {};
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== "") {
          validFilters[key] = filters[key];
        }
      });
    }

    const options: any = {
      page,
      pageSize,
      sortBy: ["!DateCreated"],
      filters: validFilters
    };
    
    if (search) {
      options.search = search;
    }

    const usersList = await Users.List(buyerId, options);
    return { success: true, data: JSON.parse(JSON.stringify(usersList)) };
  } catch (err: any) {
    console.error("Get Customers Error:", err);
    return { success: false, error: err.message || "Failed to get customers" };
  }
}

export async function getPromotions(
  page = 1,
  pageSize = 20,
  search?: string,
  active?: string,
) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Promotions, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const filters: any = {};
    if (active === "true" || active === "false") {
      filters.Active = active;
    }
    filters["xp.Country"] = 'SiteCoreAI';

    const list = await Promotions.List({
      page,
      pageSize,
      search,
      filters,
      sortBy: ["!Priority"],
    });

    return { success: true, data: JSON.parse(JSON.stringify(list)) };
  } catch (err: any) {
    console.error("Get Promotions Error:", err);
    return { success: false, error: err.message || "Failed to get promotions" };
  }
}

export async function createPromotion(payload: {
  name: string;
  code: string;
  active: boolean;
  autoApply: boolean;
  canCombine: boolean;
  type: "FixedAmount" | "Percentage";
  amount: number;
  priority?: number;
  startDate?: string;
  expirationDate?: string;
  messageEn?: string;
  allowAllUserGroups?: boolean;
}) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Promotions, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);
    const buyerId = resolveOrderCloudBuyerId();

    const normalizedAmount = Number(payload.amount) || 0;
    const valueExpression =
      payload.type === "Percentage"
        ? `order.Subtotal * ${(normalizedAmount / 100).toString()}`
        : normalizedAmount.toString();

    const created = await Promotions.Create({
      Name: payload.name.trim(),
      Code: payload.code.trim(),
      Active: payload.active,
      AutoApply: payload.autoApply,
      CanCombine: payload.canCombine,
      Priority: payload.priority,
      StartDate: payload.startDate || undefined,
      ExpirationDate: payload.expirationDate || undefined,
      EligibleExpression: "order.Subtotal > 0",
      ValueExpression: valueExpression,
      xp: {
        PromotionType: payload.type,
        Country: "SiteCoreAI",
        MessageEn: payload.messageEn?.trim() || undefined,
        AllowAllUserGroups: payload.allowAllUserGroups !== false,
      },
    } as any);

    await Promotions.SaveAssignment({
      PromotionID: created.ID,
      BuyerID: buyerId,
    });

    return { success: true, data: JSON.parse(JSON.stringify(created)) };
  } catch (err: any) {
    console.error("Create Promotion Error:", err);
    return { success: false, error: err.message || "Failed to create promotion" };
  }
}

export async function updatePromotion(payload: {
  id: string;
  active: boolean;
  autoApply: boolean;
  canCombine: boolean;
  type: "FixedAmount" | "Percentage";
  amount: number;
  priority?: number;
  startDate?: string;
  expirationDate?: string;
  messageEn?: string;
  allowAllUserGroups?: boolean;
}) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");
    const { Promotions, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const normalizedAmount = Number(payload.amount) || 0;
    const valueExpression =
      payload.type === "Percentage"
        ? `order.Subtotal * ${(normalizedAmount / 100).toString()}`
        : normalizedAmount.toString();

    const updated = await Promotions.Patch(payload.id, {
      Active: payload.active,
      AutoApply: payload.autoApply,
      CanCombine: payload.canCombine,
      Priority: payload.priority,
      StartDate: payload.startDate || undefined,
      ExpirationDate: payload.expirationDate || undefined,
      EligibleExpression: "order.Subtotal > 0",
      ValueExpression: valueExpression,
      xp: {
        PromotionType: payload.type,
        Country: "SiteCoreAI",
        MessageEn: payload.messageEn?.trim() || undefined,
        AllowAllUserGroups: payload.allowAllUserGroups !== false,
      },
    } as any);

    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (err: any) {
    console.error("Update Promotion Error:", err);
    return { success: false, error: err.message || "Failed to update promotion" };
  }
}

export async function getCustomerDetail(customerId: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Users, Tokens, Addresses, UserGroups, Me } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const customer = await Users.Get(buyerId, customerId);

    const [groupAssignmentsRes, addressAssignmentsRes, impersonationAuth] = await Promise.all([
      UserGroups.ListUserAssignments(buyerId, { userID: customerId, pageSize: 100 }).catch(() => ({ Items: [] })),
      Addresses.ListAssignments(buyerId, { userID: customerId, pageSize: 100 }).catch(() => ({ Items: [] })),
      getOrderCloudImpersonationToken(buyerId, customerId),
    ]);

    const groupIds = Array.from(
      new Set((groupAssignmentsRes as any).Items?.map((a: any) => a.UserGroupID).filter(Boolean) ?? []),
    ) as string[];

    const addressIds = Array.from(
      new Set((addressAssignmentsRes as any).Items?.map((a: any) => a.AddressID).filter(Boolean) ?? []),
    ) as string[];

    const [groups, addresses] = await Promise.all([
      Promise.all(
        groupIds.map(async (groupId) => {
          try {
            return await UserGroups.Get(buyerId, groupId);
          } catch {
            return { ID: groupId, Name: groupId };
          }
        }),
      ),
      impersonationAuth.success && impersonationAuth.token
        ? Me.ListAddresses(
            { pageSize: 100 },
            {
              accessToken: impersonationAuth.token,
            } as any,
          )
            .then((res) => res.Items || [])
            .catch(() => [])
        : Promise.all(
            addressIds.map(async (addressId) => {
              try {
                return await Addresses.Get(buyerId, addressId);
              } catch {
                return { ID: addressId };
              }
            }),
          ),
    ]);

    return {
      success: true,
      data: JSON.parse(
        JSON.stringify({
          customer,
          groups,
          addresses,
        }),
      ),
    };
  } catch (err: any) {
    console.error("Get Customer Detail Error:", err);
    return { success: false, error: err.message || "Failed to get customer detail" };
  }
}

export async function createCustomerAddress(
  customerId: string,
  payload: {
    firstName: string;
    lastName: string;
    mobile?: string;
    mobileAreaCode?: string;
    companyName?: string;
    street1: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    dpid?: string;
    saveAs?: "Home" | "Business";
    useDefaultBilling?: boolean;
    useDefaultShipping?: boolean;
  },
) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Me, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const impersonationAuth = await getOrderCloudImpersonationToken(buyerId, customerId);
    if (!impersonationAuth.success || !impersonationAuth.token) {
      throw new Error(impersonationAuth.error || "Failed to impersonate customer");
    }
    const usage = normalizeMeAddressUsage(payload.useDefaultBilling, payload.useDefaultShipping);

    const created = await Me.CreateAddress({
      AddressName: payload.saveAs || "Home",
      FirstName: payload.firstName,
      LastName: payload.lastName,
      CompanyName: payload.companyName || undefined,
      Street1: payload.street1,
      City: payload.suburb || "N/A",
      State: payload.state || undefined,
      Zip: payload.postcode || undefined,
      Country: "SC",
      Phone: payload.mobile ? `${payload.mobileAreaCode || ""}${payload.mobile}` : undefined,
      Billing: usage.billing,
      Shipping: usage.shipping,
      xp: {
        SaveAddressAs: payload.saveAs || undefined,
        MobileAreaCode: payload.mobileAreaCode || undefined,
        DPID: payload.dpid || undefined,
      },
    } as any, {
      accessToken: impersonationAuth.token,
    } as any);

    return { success: true, data: JSON.parse(JSON.stringify(created)) };
  } catch (err: any) {
    console.error("Create Customer Address Error:", err);
    return { success: false, error: err.message || "Failed to create customer address" };
  }
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  payload: {
    firstName: string;
    lastName: string;
    mobile?: string;
    mobileAreaCode?: string;
    companyName?: string;
    street1: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    dpid?: string;
    saveAs?: "Home" | "Business";
    useDefaultBilling?: boolean;
    useDefaultShipping?: boolean;
  },
) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Me, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const impersonationAuth = await getOrderCloudImpersonationToken(buyerId, customerId);
    if (!impersonationAuth.success || !impersonationAuth.token) {
      throw new Error(impersonationAuth.error || "Failed to impersonate customer");
    }
    const usage = normalizeMeAddressUsage(payload.useDefaultBilling, payload.useDefaultShipping);

    const updated = await Me.SaveAddress(addressId, {
      AddressName: payload.saveAs || undefined,
      FirstName: payload.firstName,
      LastName: payload.lastName,
      CompanyName: payload.companyName || undefined,
      Street1: payload.street1,
      City: payload.suburb || "N/A",
      State: payload.state || undefined,
      Zip: payload.postcode || undefined,
      Country: "SC",
      Phone: payload.mobile ? `${payload.mobileAreaCode || ""}${payload.mobile}` : undefined,
      Billing: usage.billing,
      Shipping: usage.shipping,
      xp: {
        SaveAddressAs: payload.saveAs || undefined,
        MobileAreaCode: payload.mobileAreaCode || undefined,
        DPID: payload.dpid || undefined,
      },
    } as any, {
      accessToken: impersonationAuth.token,
    } as any);

    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (err: any) {
    console.error("Update Customer Address Error:", err);
    return { success: false, error: err.message || "Failed to update customer address" };
  }
}

export async function deleteCustomerAddress(customerId: string, addressId: string) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Addresses, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    // Best effort: remove assignment for this user first.
    try {
      await Addresses.DeleteAssignment(buyerId, addressId, { userID: customerId });
    } catch {
      // ignore
    }

    await Addresses.Delete(buyerId, addressId);

    return { success: true };
  } catch (err: any) {
    console.error("Delete Customer Address Error:", err);
    return { success: false, error: err.message || "Failed to delete customer address" };
  }
}

export async function updateCustomer(
  customerId: string,
  payload: {
    firstName: string;
    lastName: string;
    mobileNumber: string;
    confirmedEmail: boolean;
    active: boolean;
  },
) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Users, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const updated = await Users.Patch(buyerId, customerId, {
      FirstName: payload.firstName,
      LastName: payload.lastName,
      Active: payload.active,
      // Keep Phone in sync for display/search (best effort).
      Phone: payload.mobileNumber,
      xp: {
        PersonalInformation: {
          MobileNumber: payload.mobileNumber,
          IsConfirmedEmail: payload.confirmedEmail,
        },
      },
    } as any);

    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (err: any) {
    console.error("Update Customer Error:", err);
    return { success: false, error: err.message || "Failed to update customer" };
  }
}
