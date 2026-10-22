import { OrderCloudUserSession } from "./auth-types";

/**
 * Mã hóa dữ liệu session thành chuỗi Base64 an toàn cho HTTP Cookie (RFC 6265)
 * Tránh lỗi do ký tự đặc biệt (dấu ngoặc kép, dấu phẩy, dấu cách, dấu ngoặc nhọn).
 */
export function serializeSession(session: OrderCloudUserSession): string {
  const json = JSON.stringify(session);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64");
  }
  return btoa(encodeURIComponent(json));
}

/**
 * Giải mã chuỗi cookie session (hỗ trợ cả Base64, raw JSON và URL-encoded JSON)
 */
export function deserializeSession(raw: string | undefined | null): OrderCloudUserSession | null {
  if (!raw) return null;

  // 1. Thử giải mã Base64
  try {
    let jsonStr = "";
    if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(raw, "base64").toString("utf-8");
    } else {
      jsonStr = decodeURIComponent(atob(raw));
    }
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object") {
      return parsed as OrderCloudUserSession;
    }
  } catch {
    // Không phải base64 hoặc lỗi decode, tiếp tục fallback
  }

  // 2. Fallback: Parse trực tiếp raw JSON
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as OrderCloudUserSession;
    }
  } catch {
    // Không phải raw JSON
  }

  // 3. Fallback: Parse URL-encoded JSON (%7B%22...)
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === "object") {
      return parsed as OrderCloudUserSession;
    }
  } catch {
    // Lỗi parse
  }

  return null;
}
