import * as mdi from "@mdi/js";

export interface SiteNavigationItem {
  title: string;
  url: string;
  icon: string;
  external?: boolean;
  roles?: string[];
  adminOnly?: boolean;
}

export interface SiteNavigationGroup {
  title: string;
  items: SiteNavigationItem[];
  adminOnly?: boolean;
}

export const siteBrandName = "Admin Portal";

export const siteNavigationGroups: SiteNavigationGroup[] = [
  {
    title: "Products",
    items: [
      {
        title: "Product Management",
        url: "/product",
        icon: mdi.mdiPackageVariantClosed,
        roles: ["ADMIN_CONTENTPRODUCT", "ADMIN_AWAITINGAPPROVAL", "ADMIN_PRODUCT_READER"],
      },
    ],
  },
  {
    title: "Orders",
    items: [
      {
        title: "Order Management",
        url: "/orders",
        icon: mdi.mdiClipboardListOutline,
        roles: ["COUNTRY_ORDER_EDITOR", "COUNTRY_ORDER_READER"],
      },
    ],
  },
  {
    title: "Customers",
    items: [
      {
        title: "Customer Management",
        url: "/customers",
        icon: mdi.mdiAccountMultipleOutline,
        roles: [
          "COUNTRY_CUSTOMER_EDITOR",
          "COUNTRY_CUSTOMER_MANAGER",
          "COUNTRY_CUSTOMER_READER",
        ],
      },
    ],
  },
  {
    title: "Promotions",
    items: [
      {
        title: "Promotion Management",
        url: "/promotions",
        icon: mdi.mdiTicketPercentOutline,
        roles: ["COUNTRY_MARKETING_EDITOR", "COUNTRY_MARKETING_READER"],
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        title: "Product & Inventory Analytics",
        url: "/report",
        icon: mdi.mdiChartBoxOutline,
      },
    ],
  },
  {
    title: "Reports",
    items: [
      {
        title: "Product & Inventory Analytics",
        url: "/report",
        icon: mdi.mdiChartBoxOutline,
      },
    ],
  },
  {
    title: "Tax Configuration",
    items: [
      {
        title: "GST Configuration",
        url: "/gst-configuration",
        icon: mdi.mdiCogOutline,
        roles: ["COUNTRY_TAX_CONFIG"],
      },
    ],
  },
  {
    title: "System Administration",
    adminOnly: true,
    items: [
      {
        title: "User & Role Management",
        url: "/admin/users",
        icon: mdi.mdiShieldAccountOutline,
        adminOnly: true,
      },
    ],
  },
];
