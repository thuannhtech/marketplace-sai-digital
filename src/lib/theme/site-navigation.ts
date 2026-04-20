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

export const siteBrandName = "Blok Marketplace";

export const siteNavigationGroups: SiteNavigationGroup[] = [
  {
    title: "Products",
    items: [
      {
        title: "Product Listing",
        url: "/product",
        icon: mdi.mdiPackageVariantClosed,
      },
    ],
  },
];

export const siteNavigationFooterItems: SiteNavigationItem[] = [
  {
    title: "Settings",
    url: "/settings",
    icon: mdi.mdiCogOutline,
  },
  {
    title: "Documentation",
    url: "https://blok.sitecore.com",
    icon: mdi.mdiBookOpenVariant,
    external: true,
  },
];
