"use client";

import * as React from "react";
import * as mdi from "@mdi/js";
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
import { siteBrandName, siteNavigationFooterItems, siteNavigationGroups } from "@/src/lib/theme/site-navigation";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <Icon path={mdi.mdiAlphaB} size={1} />
          </div>
          <span className="truncate group-data-[collapsible=icon]:hidden font-heading">
            {siteBrandName}
          </span>
        </div>
      </div>
      <SidebarContent>
        {siteNavigationGroups.map((group) => (
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
                      isActive={pathname === item.url}
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
      <div className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          {siteNavigationFooterItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
              >
                <a href={item.url} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined}>
                  <Icon path={item.icon} className="h-4 w-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </Sidebar>
  );
}
