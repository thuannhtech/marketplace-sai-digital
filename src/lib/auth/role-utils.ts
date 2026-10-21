import { PAGE_PERMISSIONS } from "./roles-config";

/**
 * Check whether the user is a Super Admin.
 * Strictly checks user.xp.Roles for SUPPER_ADMIN.
 * Does not check FullAccess because OrderCloud automatically assigns FullAccess to all users via ADMIN_COUNTRY.
 */
export function isSuperAdmin(roles?: string[], username?: string): boolean {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.includes("SUPPER_ADMIN");
}

/**
 * Check whether the user has a specific role
 */
export function hasRole(roles: string[] | undefined, targetRole: string, username?: string): boolean {
  if (isSuperAdmin(roles, username)) return true;
  if (!roles || !Array.isArray(roles)) return false;
  return roles.includes(targetRole);
}

/**
 * Find page permission config for a given route pathname
 */
function findPermissionForPath(pathname: string) {
  // Normalize pathname by removing query params and trailing slash
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "") || "/";

  for (const [route, perm] of Object.entries(PAGE_PERMISSIONS)) {
    if (cleanPath === route || cleanPath.startsWith(route + "/")) {
      return perm;
    }
  }
  return null;
}

/**
 * Check whether the user has Read access for a given pathname
 */
export function canAccessPage(pathname: string, roles?: string[], username?: string): boolean {
  if (isSuperAdmin(roles, username)) return true;
  if (!roles || !Array.isArray(roles)) return false;

  // Admin Management (/admin/users) -> Only Super Admin can access
  if (pathname.startsWith("/admin")) {
    return isSuperAdmin(roles, username);
  }

  const perm = findPermissionForPath(pathname);
  if (!perm) {
    // Routes not requiring specific module permissions (e.g. home, dashboard)
    return true;
  }

  // Requires at least one role in read list
  return perm.read.some((r) => roles.includes(r));
}

/**
 * Check whether the user has Write (create/edit/delete) access for a given module pathname
 */
export function canWritePage(pathname: string, roles?: string[], username?: string): boolean {
  if (isSuperAdmin(roles, username)) return true;
  if (!roles || !Array.isArray(roles)) return false;

  const perm = findPermissionForPath(pathname);
  if (!perm) return false;

  return perm.write.some((r) => roles.includes(r));
}

/**
 * Check whether the user has Approve (publish/approve) access for a given module pathname
 */
export function canApprovePage(pathname: string, roles?: string[], username?: string): boolean {
  if (isSuperAdmin(roles, username)) return true;
  if (!roles || !Array.isArray(roles)) return false;

  const perm = findPermissionForPath(pathname);
  if (!perm || !perm.approve) return false;

  return perm.approve.some((r) => roles.includes(r));
}

/**
 * Retrieve the default redirect page based on accessible roles
 */
export function getDefaultRedirectPage(roles?: string[], username?: string): string {
  if (isSuperAdmin(roles, username)) return "/product";
  if (canAccessPage("/customers", roles, username)) return "/customers";
  if (canAccessPage("/product", roles, username)) return "/product";
  if (canAccessPage("/orders", roles, username)) return "/orders";
  if (canAccessPage("/promotions", roles, username)) return "/promotions";
  if (canAccessPage("/gst-configuration", roles, username)) return "/gst-configuration";
  return "/unauthorized";
}

