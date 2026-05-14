"use server";

import { Auth, Configuration } from "ordercloud-javascript-sdk";

export async function getOrderCloudToken() {
  const clientID = process.env.NEXT_PUBLIC_ORDERCLOUD_CLIENT_ID || "";
  const username = process.env.ORDERCLOUD_USERNAME || "";
  const password = process.env.ORDERCLOUD_PASSWORD || "";
  const baseApiUrl = process.env.NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL || "https://sandboxapi.ordercloud.io";

  const clientSecret = process.env.ORDERCLOUD_CLIENT_SECRET || "";

  Configuration.Set({
    baseApiUrl: baseApiUrl,
    clientID,
  });

  try {
    const formData = new URLSearchParams();
    formData.append("grant_type", "password");
    formData.append("client_id", clientID);
    formData.append("client_secret", clientSecret);
    formData.append("username", username);
    formData.append("password", password);
    formData.append("scope", "FullAccess");

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

/** Buyer ID from env — used only to scope incoming orders (`Orders.List` / detail check). */
function resolveOrderCloudBuyerId(): string {
  const raw = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
  const buyerId = typeof raw === "string" ? raw.trim() : "";
  if (!buyerId) {
    throw new Error("Missing Buyer ID in environment variables");
  }
  return buyerId;
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

    let shippingAddress = null;
    if (order.ShippingAddressID) {
      try {
        shippingAddress = await Me.GetAddress(order.ShippingAddressID);
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
             card = await Me.GetCreditCard(payment.CreditCardID);
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

    const { Users, Tokens, Addresses, UserGroups } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const customer = await Users.Get(buyerId, customerId);

    const [groupAssignmentsRes, addressAssignmentsRes] = await Promise.all([
      UserGroups.ListUserAssignments(buyerId, { userID: customerId, pageSize: 100 }).catch(() => ({ Items: [] })),
      Addresses.ListAssignments(buyerId, { userID: customerId, pageSize: 100 }).catch(() => ({ Items: [] })),
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
      Promise.all(
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

    const { Addresses, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const created = await Addresses.Create(buyerId, {
      AddressName: payload.saveAs || "Home",
      FirstName: payload.firstName,
      LastName: payload.lastName,
      CompanyName: payload.companyName || undefined,
      Street1: payload.street1,
      City: "N/A",
      Country: "SC",
      Phone: payload.mobile ? `${payload.mobileAreaCode || ""}${payload.mobile}` : undefined,
      xp: {
        SaveAddressAs: payload.saveAs || undefined,
        MobileAreaCode: payload.mobileAreaCode || undefined,
      },
    } as any);

    // Assign the created address to this user (and optionally mark as default shipping/billing).
    await Addresses.SaveAssignment(buyerId, {
      AddressID: created.ID,
      UserID: customerId,
      IsBilling: Boolean(payload.useDefaultBilling),
      IsShipping: Boolean(payload.useDefaultShipping),
    });

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
    saveAs?: "Home" | "Business";
    useDefaultBilling?: boolean;
    useDefaultShipping?: boolean;
  },
) {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) throw new Error("Auth failed");

    const { Addresses, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);

    const buyerId = process.env.NEXT_PUBLIC_ORDERCLOUD_BUYER_ID || process.env.ORDERCLOUD_BUYER_ID;
    if (!buyerId) throw new Error("Missing Buyer ID in environment variables");

    const updated = await Addresses.Patch(buyerId, addressId, {
      AddressName: payload.saveAs || undefined,
      FirstName: payload.firstName,
      LastName: payload.lastName,
      CompanyName: payload.companyName || undefined,
      Street1: payload.street1,
      City: "N/A",
      Country: "SC",
      Phone: payload.mobile ? `${payload.mobileAreaCode || ""}${payload.mobile}` : undefined,
      xp: {
        SaveAddressAs: payload.saveAs || undefined,
      },
    } as any);

    await Addresses.SaveAssignment(buyerId, {
      AddressID: addressId,
      UserID: customerId,
      IsBilling: Boolean(payload.useDefaultBilling),
      IsShipping: Boolean(payload.useDefaultShipping),
    });

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
