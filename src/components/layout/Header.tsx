"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const routeMap: Record<string, string> = {
  "/product": "Product Listing",
};

export function Header() {
  const pathname = usePathname();
  const pageName = routeMap[pathname];

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <SidebarTrigger className="-ml-1 text-neutral-fg hover:bg-neutral-hover hover:text-neutral-fg" />
      <Separator orientation="vertical" className="mr-2 h-4 bg-sidebar-border" />
      <div className="flex flex-1 items-center justify-between">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-subtle-text">
            <li className="hover:text-primary transition-colors cursor-pointer">
              Marketplace
            </li>
            <li className="text-sidebar-border">/</li>
            <li className="font-semibold text-body-text">{pageName}</li>
          </ol>
        </nav>
        <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        </div>
      </div>
    </header>
  );
}
