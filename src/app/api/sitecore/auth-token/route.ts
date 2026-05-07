import { NextResponse } from "next/server";

const SITECORE_AUTH_URL = "https://auth.sitecorecloud.io/oauth/token";

export async function POST() {
  const clientId = process.env.NEXT_PUBLIC_SITECORE_CLOUD_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.NEXT_PUBLIC_SITECORE_CLOUD_CLIENT_SECRET?.trim() || "";
  const audience = "https://api.sitecorecloud.io";

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "Missing SITECORE_CLOUD_CLIENT_ID or SITECORE_CLOUD_CLIENT_SECRET.",
      },
      { status: 500 },
    );
  }

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("audience", audience);

  try {
    const response = await fetch(SITECORE_AUTH_URL, {
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
            : "Failed to fetch Sitecore auth token.";

      return NextResponse.json({ error: message }, { status: response.status });
    }

    const accessToken = typeof data.access_token === "string" ? data.access_token : "";
    const tokenType = typeof data.token_type === "string" ? data.token_type : "Bearer";
    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : undefined;

    if (!accessToken) {
      return NextResponse.json({ error: "Sitecore auth response missing access_token." }, { status: 502 });
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
    const message = error instanceof Error ? error.message : "Failed to fetch Sitecore auth token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
