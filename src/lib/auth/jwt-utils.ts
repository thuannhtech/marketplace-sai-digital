export interface OrderCloudJWTPayload {
  usr?: string;
  cid?: string;
  usrtype?: string;
  role?: string | string[];
  exp?: number;
  iss?: string;
  [key: string]: any;
}

/**
 * Giải mã chuỗi JWT không cần secret (Client-side / Middleware safe)
 */
export function decodeJwt(token: string): OrderCloudJWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

/**
 * Kiểm tra xem token đã hết hạn chưa.
 * @param token Chuỗi JWT
 * @param bufferSeconds Thời gian đệm (mặc định 10 giây để tránh chênh lệch clock)
 */
export function isTokenExpired(token: string, bufferSeconds = 10): boolean {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return payload.exp <= currentTimestamp + bufferSeconds;
}

/**
 * Lấy danh sách Roles từ Token payload
 */
export function extractRolesFromToken(token: string): string[] {
  const payload = decodeJwt(token);
  if (!payload || !payload.role) return [];
  if (Array.isArray(payload.role)) {
    return payload.role;
  }
  return [payload.role];
}
