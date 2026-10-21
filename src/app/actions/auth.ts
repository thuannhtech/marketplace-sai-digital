"use server";

import { cookies } from "next/headers";
import { OrderCloudUserSession } from "@/src/lib/auth/auth-types";
import { decodeJwt, extractRolesFromToken, isTokenExpired } from "@/src/lib/auth/jwt-utils";
import { isSuperAdmin, getDefaultRedirectPage } from "@/src/lib/auth/role-utils";
import { ALL_ORDERCLOUD_ROLES } from "@/src/lib/auth/roles-config";
import { OC_SESSION_COOKIE } from "@/src/lib/auth/constants";

/**
 * Đăng nhập Admin User vào OrderCloud
 */
export async function loginAdminAction(formData: { username?: string; password?: string }) {
  const username = formData.username?.trim();
  const password = formData.password?.trim();

  if (!username || !password) {
    return { success: false, error: "Please enter both username and password." };
  }

  const clientID = process.env.NEXT_PUBLIC_ORDERCLOUD_CLIENT_ID || "";
  const clientSecret = process.env.ORDERCLOUD_CLIENT_SECRET || "";
  const baseApiUrl = process.env.NEXT_PUBLIC_ORDERCLOUD_BASE_API_URL || "https://sandboxapi.ordercloud.io";

  try {
    const bodyParams = new URLSearchParams();
    bodyParams.append("grant_type", "password");
    bodyParams.append("client_id", clientID);
    if (clientSecret) {
      bodyParams.append("client_secret", clientSecret);
    }
    bodyParams.append("username", username);
    bodyParams.append("password", password);
    // Note: Do not send custom scope; OrderCloud automatically grants all assigned user roles

    const response = await fetch(`${baseApiUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.error_description ||
        data.error ||
        (data.Errors && data.Errors[0]?.Message) ||
        "Invalid username or password.";
      return { success: false, error: errorMsg };
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      return { success: false, error: "Failed to obtain token from OrderCloud." };
    }

    const payload = decodeJwt(accessToken);
    const roles = extractRolesFromToken(accessToken);
    const userId = payload?.usr || username;
    const expiresAt = payload?.exp || Math.floor(Date.now() / 1000) + 3600;

    // Lấy thêm thông tin chi tiết user từ Me.Get
    let firstName = "";
    let lastName = "";
    let email = "";
    let xpRoles: string[] = [];
    let userXp: Record<string, any> = {};

    try {
      const meResponse = await fetch(`${baseApiUrl}/v1/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (meResponse.ok) {
        const meData = await meResponse.json();
        firstName = meData.FirstName || "";
        lastName = meData.LastName || "";
        email = meData.Email || "";
        if (Array.isArray(meData.xp?.Roles)) {
          xpRoles = meData.xp.Roles;
        }
        if (meData.xp) {
          userXp = meData.xp;
        }
      }
    } catch {
      // Bỏ qua nếu Me.Get không khả dụng
    }

    // Chỉ kiểm tra trong xp.Roles theo cấu trúc phân quyền của hệ thống
    const effectiveRoles = Array.isArray(xpRoles) ? xpRoles : [];
    const isUserSuperAdmin = isSuperAdmin(effectiveRoles, username);

    const session: OrderCloudUserSession = {
      userId,
      username,
      firstName,
      lastName,
      email,
      roles: effectiveRoles,
      xpRoles,
      xp: userXp,
      isSuperAdmin: isUserSuperAdmin,
      accessToken,
      expiresAt,
    };

    const cookieStore = await cookies();
    cookieStore.set(OC_SESSION_COOKIE, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    });

    const targetUrl = getDefaultRedirectPage(effectiveRoles, username);
    return { success: true, user: session, targetUrl };
  } catch (err: any) {
    console.error("Login Action Error:", err);
    return {
      success: false,
      error: err.message || "An error occurred while connecting to OrderCloud.",
    };
  }
}

/**
 * Đăng xuất: Xóa cookie session
 */
export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete(OC_SESSION_COOKIE);
  return { success: true };
}

/**
 * Lấy session Admin User hiện tại từ Cookie
 */
export async function getCurrentAdminUserAction(): Promise<{
  success: boolean;
  user?: OrderCloudUserSession;
  expired?: boolean;
}> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(OC_SESSION_COOKIE);

    if (!sessionCookie || !sessionCookie.value) {
      return { success: false };
    }

    const session: OrderCloudUserSession = JSON.parse(sessionCookie.value);

    // Kiểm tra token đã hết hạn chưa
    if (isTokenExpired(session.accessToken)) {
      cookieStore.delete(OC_SESSION_COOKIE);
      return { success: false, expired: true };
    }

    return { success: true, user: session };
  } catch (err) {
    console.error("Get Current Admin User Error:", err);
    return { success: false };
  }
}
