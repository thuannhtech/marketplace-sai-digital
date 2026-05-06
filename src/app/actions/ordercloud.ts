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

export async function getIncomingOrders() {
  try {
    const auth = await getOrderCloudToken();
    if (!auth.success || !auth.token) {
      throw new Error(`Không thể đăng nhập OrderCloud: ${auth.error}`);
    }

    const { Orders, Tokens } = await import("ordercloud-javascript-sdk");
    Tokens.SetAccessToken(auth.token);
    
    const orders = await Orders.List("Incoming");
    
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
    
    const order = await Orders.Get("Incoming", orderId);
    
    const [lineItemsRes, promotionsRes, paymentsRes] = await Promise.all([
      LineItems.List("All", orderId).catch(() => ({ Items: [] })),
      Orders.ListPromotions("All", orderId).catch(() => ({ Items: [] })),
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

    // Mock fetching CouponCode from db.CustomCouponHistories
    // Real logic: Query API/Workato with orderId and customerId (order.FromUser?.ID)
    // and match CustomCoupon.PromotionOrderCloudID == PromotionID
    // Handle missing promotions by injecting a fake one for demo purposes
    // since the API might return an empty array if the order truly has no promotions.
    // OrderCloud SDK typings here can be very strict (deep required types).
    // We treat promotions as plain JSON so we can safely enrich/mocks without TS friction.
    let promoItems: any[] = (promotionsRes as any).Items || [];
    if (promoItems.length === 0) {
      promoItems = [{
        ID: "BROTHER-00000113",
        Amount: 5314.4,
        xp: {
          PromotionFrom: "EC",
          PromotionType: "PERCENTAGE"
        }
      }];
    }

    const enrichedPromotions = promoItems.map((promo: any) => {
      // Mock logic: generate a fake coupon code if it doesn't have one natively
      let mockedCouponCode = promo.Code;
      if (!mockedCouponCode) {
        if (promo.ID === "BROTHER-00000113") mockedCouponCode = "WELCOME10";
        else mockedCouponCode = `CPN-${Math.floor(Math.random() * 10000)}`;
      }
      return {
        ...promo,
        Code: mockedCouponCode
      };
    });

    const resultData = {
      ...order,
      LineItems: lineItemsRes.Items,
      AppliedPromotions: enrichedPromotions,
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

    await Orders.Patch("Incoming", orderId, {
      xp: {
        SubStatus: "COMPLETED",
        LastUpdated: new Date().toISOString()
      }
    });
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
