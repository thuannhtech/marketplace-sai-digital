"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";
import { useAuth } from "@/src/hooks/use-auth";
import { getDefaultRedirectPage } from "@/src/lib/auth/role-utils";

export default function UnauthorizedPage() {
  const { user, roles, logout } = useAuth();
  const defaultPage = getDefaultRedirectPage(roles, user?.username);
  const hasAllowedPage = defaultPage !== "/unauthorized";

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-gradient-to-br from-neutral-50 via-neutral-100 to-danger-50">
      <Card className="w-full max-w-lg border border-danger/30 shadow-xl bg-surface/95 text-center p-6">
        <CardHeader className="space-y-3 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger shadow-inner">
            <Icon path={mdi.mdiShieldAlertOutline} className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-neutral-900 font-heading">
            Access Denied
          </CardTitle>
          <CardDescription className="text-subtle-text text-sm">
            Your account does not have permission to access this page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 text-left text-sm">
          <div className="rounded-lg bg-neutral-100 p-4 space-y-2 border border-neutral-200">
            <div className="flex justify-between items-center text-xs">
              <span className="text-subtle-text">Account:</span>
              <span className="font-semibold text-neutral-800">{user?.username || "Unknown"}</span>
            </div>
            <div className="flex justify-between items-start text-xs pt-1 border-t border-neutral-200">
              <span className="text-subtle-text shrink-0">Current Roles:</span>
              <span className="font-mono text-neutral-700 text-right max-w-xs break-words">
                {roles && roles.length > 0 ? roles.join(", ") : "No roles assigned"}
              </span>
            </div>
          </div>

          <p className="text-xs text-subtle-text text-center">
            Please contact your <strong>Super Admin</strong> to request appropriate permissions or navigate to an authorized module.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/">
                <Icon path={mdi.mdiArrowLeft} className="h-4 w-4 mr-1.5" />
                Go to Home Page
              </Link>
            </Button>
            <Button
              colorScheme="danger"
              className="w-full sm:w-auto"
              onClick={() => logout()}
            >
              <Icon path={mdi.mdiLogout} className="h-4 w-4 mr-1.5" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
