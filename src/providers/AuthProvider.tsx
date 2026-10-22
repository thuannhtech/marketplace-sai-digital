"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { OrderCloudUserSession } from "@/src/lib/auth/auth-types";
import { getCurrentAdminUserAction, logoutAdminAction } from "@/src/app/actions/auth";
import { isTokenExpired } from "@/src/lib/auth/jwt-utils";
import { hasRole as checkRole, canAccessPage as checkAccess, canWritePage as checkWrite, canApprovePage as checkApprove, isSuperAdmin as checkSuperAdmin } from "@/src/lib/auth/role-utils";

interface AuthContextType {
  user: OrderCloudUserSession | null;
  roles: string[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  hasRole: (role: string) => boolean;
  canAccess: (pathname: string) => boolean;
  canWrite: (pathname: string) => boolean;
  canApprove: (pathname: string) => boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  roles: [],
  isSuperAdmin: false,
  isLoading: true,
  hasRole: () => false,
  canAccess: () => false,
  canWrite: () => false,
  canApprove: () => false,
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OrderCloudUserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(async (reason?: "expired") => {
    setUser(null);
    await logoutAdminAction();
    if (reason === "expired") {
      router.push("/login?expired=1");
    } else {
      router.push("/login");
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getCurrentAdminUserAction();
      if (res.expired) {
        await logout("expired");
        return;
      }
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Refresh User Error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Kiểm tra định kỳ token hết hạn ở Client
  useEffect(() => {
    if (!user?.accessToken) return;

    const checkInterval = setInterval(() => {
      if (isTokenExpired(user.accessToken)) {
        logout("expired");
      }
    }, 15000); // 15 giây kiểm tra 1 lần

    return () => clearInterval(checkInterval);
  }, [user, logout]);

  const roles = Array.isArray(user?.xpRoles) ? user.xpRoles : (Array.isArray(user?.roles) ? user.roles : []);
  const superAdmin = user?.isSuperAdmin ?? checkSuperAdmin(roles, user?.username);

  const hasRole = useCallback((role: string) => checkRole(roles, role, user?.username), [roles, user?.username]);
  const canAccess = useCallback((path: string) => checkAccess(path, roles, user?.username), [roles, user?.username]);
  const canWrite = useCallback((path: string) => checkWrite(path, roles, user?.username), [roles, user?.username]);
  const canApprove = useCallback((path: string) => checkApprove(path, roles, user?.username), [roles, user?.username]);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        isSuperAdmin: superAdmin,
        isLoading,
        hasRole,
        canAccess,
        canWrite,
        canApprove,
        logout: () => logout(),
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
