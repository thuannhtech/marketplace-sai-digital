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
        title: "Product Listing",
        url: "/product",
        icon: mdi.mdiPackageVariantClosed,
      },
    ],
  },
];
