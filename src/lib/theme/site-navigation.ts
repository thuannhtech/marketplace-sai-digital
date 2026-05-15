import * as mdi from "@mdi/js";

export interface SiteNavigationItem {
  title: string;
  url: string;
  icon: string;
  external?: boolean;
}

export interface SiteNavigationGroup {
  title: string;
  items: SiteNavigationItem[];
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
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        title: "Gst Configuration",
        url: "/gst-configuration",
        icon: mdi.mdiCogOutline,
      },
    ],
  },
];
