"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/src/hooks/use-auth";
import { Icon } from "@/lib/icon";
import * as mdi from "@mdi/js";

const routeMap: Record<string, string> = {
  "/product": "Product Listing",
  "/orders": "Order Listing",
  "/customers": "Customer Listing",
  "/promotions": "Promotion Listing",
  "/admin/users": "User & Role Management",
  "/gst-configuration": "GST Configuration",
  "/report": "Product & Inventory Analytics",
};

export function Header() {
  const pathname = usePathname();
  const pageName = routeMap[pathname] || "Dashboard";
  const { user, isSuperAdmin, logout } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <SidebarTrigger className="-ml-1 text-neutral-fg hover:bg-neutral-hover hover:text-neutral-fg" />
      <Separator orientation="vertical" className="mr-2 h-4 bg-sidebar-border" />
      <div className="flex flex-1 items-center justify-between">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-subtle-text">
            <li className="hover:text-primary transition-colors cursor-pointer">
              Admin Portal
            </li>
            <li className="text-sidebar-border">/</li>
            <li className="font-semibold text-body-text">{pageName}</li>
          </ol>
        </nav>

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-neutral-800 leading-tight">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username}
                </span>
                <span className="text-[11px] text-subtle-text">@{user.username}</span>
              </div>

              {isSuperAdmin ? (
                <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-0 text-[11px] font-medium px-2 py-0.5">
                  <Icon path={mdi.mdiCrownOutline} className="h-3 w-3 mr-1" />
                  Super Admin
                </Badge>
              ) : (
                <Badge colorScheme="neutral" className="text-[11px] font-medium px-2 py-0.5">
                  Admin User
                </Badge>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="text-subtle-text hover:text-danger hover:bg-danger/10 h-8 px-2.5"
                title="Log out"
              >
                <Icon path={mdi.mdiLogout} className="h-4 w-4 mr-1 text-neutral-500" />
                <span className="text-xs">Log out</span>
              </Button>
            </div>
          )}

          <div className="h-2 w-2 rounded-full bg-success animate-pulse ml-1" title="Connected" />
        </div>
      </div>
    </header>
  );
}
