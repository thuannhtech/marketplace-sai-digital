import { NextResponse } from "next/server";

const DEFAULT_ORDERCLOUD_SCOPE =
  "BuyerAdmin BuyerReader BuyerUserAdmin BuyerUserReader BuyerImpersonation Shopper AddressAdmin MeAddressAdmin MeAdmin MeCreditCardAdmin MeXpAdmin PasswordReset ShipmentAdmin ShipmentReader OrderAdmin OrderReader UnsubmittedOrderReader OverrideUnitPrice OverrideShipping CreditCardAdmin CreditCardReader ProductAdmin ProductReader PromotionReader PromotionAdmin";

export async function POST() {
  const clientId = process.env.NEXT_PUBLIC_ORDERCLOUD_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.ORDERCLOUD_CLIENT_SECRET?.trim() || "";
  const username = process.env.ORDERCLOUD_USERNAME?.trim() || "";
  const password = process.env.ORDERCLOUD_PASSWORD?.trim() || "";
  const baseApiUrl =
    process.env.NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL?.trim() || "https://sandboxapi.ordercloud.io";
  const scope = process.env.ORDERCLOUD_TOKEN_SCOPE?.trim() || DEFAULT_ORDERCLOUD_SCOPE;

  if (!clientId || !clientSecret || !username || !password) {
    return NextResponse.json(
      {
        error: "Missing OrderCloud credentials in environment variables.",
      },
      { status: 500 },
    );
  }

  try {
    const body = new URLSearchParams();
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("username", username);
    body.set("password", password);
    body.set("scope", scope);
    body.set("grant_type", "password");

    const response = await fetch(`${baseApiUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        typeof data.error_description === "string"
          ? data.error_description
          : typeof data.error === "string"
            ? data.error
            : "Failed to fetch OrderCloud auth token.";

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const tokenType = typeof data.token_type === "string" ? data.token_type : "Bearer";
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;

    if (!accessToken) {
      return NextResponse.json({ error: "OrderCloud auth response missing access_token." }, { status: 502 });
    }

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: tokenType,
        expires_in: expiresIn,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch OrderCloud auth token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
