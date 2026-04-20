"use client";

import React, { useRef, useEffect, useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/src/components/layout/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { useContainerSize } from "@/src/hooks/use-container-size";

import { Header } from "@/src/components/layout/Header";

export function BrowserLayout({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useContainerSize(containerRef);
  const [open, setOpen] = useState(true);

  // Auto collapse sidebar if width is less than 768px (standard md breakpoint)
  useEffect(() => {
    if (width > 0 && width < 768) {
      setOpen(false);
    } else if (width >= 768) {
      setOpen(true);
    }
  }, [width]);

  return (
    <div ref={containerRef} className="layout-container h-screen w-full overflow-hidden">
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
