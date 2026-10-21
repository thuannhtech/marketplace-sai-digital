"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/lib/icon";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { siteNavigationGroups } from "@/src/lib/theme/site-navigation";
import { useAuth } from "@/src/hooks/use-auth";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { roles, isSuperAdmin, isLoading } = useAuth();

  // Lọc menu items dựa trên roles và trạng thái Super Admin
  const filteredGroups = siteNavigationGroups
    .map((group) => {
      // Nếu nhóm chỉ dành cho admin nhưng user không phải Super Admin -> Ẩn
      if (group.adminOnly && !isSuperAdmin) {
        return null;
      }

      const validItems = group.items.filter((item) => {
        // Super Admin có quyền xem tất cả
        if (isSuperAdmin) return true;

        // Nếu item chỉ dành cho admin -> Ẩn với non-admin
        if (item.adminOnly) return false;

        // Nếu item có quy định roles -> Kiểm tra xem user có ít nhất 1 role hợp lệ
        if (item.roles && item.roles.length > 0) {
          return item.roles.some((r) => roles.includes(r));
        }

        return true;
      });

      if (validItems.length === 0) return null;

      return {
        ...group,
        items: validItems,
      };
    })
    .filter(Boolean) as typeof siteNavigationGroups;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-primary">
          <span className="truncate group-data-[collapsible=icon]:hidden font-heading">
            Admin Portal
          </span>
        </div>
      </div>
      <SidebarContent>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <Icon path={item.icon} className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
