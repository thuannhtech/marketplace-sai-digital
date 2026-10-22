"use client";

import React, { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/src/components/layout/AppSidebar";
import { useContainerSize } from "@/src/hooks/use-container-size";
import { Header } from "@/src/components/layout/Header";

export function BrowserLayout({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  const isFullscreenRoute = pathname === "/login" || pathname === "/unauthorized";

  // Auto collapse sidebar if width is less than 768px (standard md breakpoint)
  useEffect(() => {
    if (width > 0 && width < 768) {
      setOpen(false);
    } else if (width >= 768) {
      setOpen(true);
    }
  }, [width]);

  if (isFullscreenRoute) {
    return (
      <div ref={containerRef} className="layout-container h-screen w-full overflow-auto bg-subtle-bg">
        {children}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="layout-container h-screen w-full overflow-auto">
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 overflow-auto p-6 bg-subtle-bg">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
