import * as mdi from "@mdi/js";

export interface ProductCategory {
  id: string;
  title: string;
  totalProducts: number;
}

export interface ProductItem {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  categoryId: string;
  status: "Published" | "Draft";
  icon: string;
}

export const productCategories: ProductCategory[] = [
  { id: "all", title: "All Products", totalProducts: 6 },
  { id: "content", title: "Content", totalProducts: 2 },
  { id: "commerce", title: "Commerce", totalProducts: 2 },
  { id: "analytics", title: "Analytics", totalProducts: 2 },
];

export const productItems: ProductItem[] = [
  {
    id: "content-hub-widget",
    name: "Content Hub Widget",
    description: "Embed curated assets directly into Pages editor experiences.",
    priceLabel: "$29 / month",
    categoryId: "content",
    status: "Published",
    icon: mdi.mdiImageMultipleOutline,
  },
  {
    id: "seo-assistant",
    name: "SEO Assistant",
    description: "Analyze title, metadata, and heading quality before publish.",
    priceLabel: "$39 / month",
    categoryId: "content",
    status: "Published",
    icon: mdi.mdiMagnifyScan,
  },
  {
    id: "catalog-sync",
    name: "Catalog Sync",
    description: "Sync product feed from third-party commerce systems in realtime.",
    priceLabel: "$59 / month",
    categoryId: "commerce",
    status: "Published",
    icon: mdi.mdiSync,
  },
  {
    id: "checkout-extension",
    name: "Checkout Extension",
    description: "Add custom fields and validation flows to checkout journey.",
    priceLabel: "$49 / month",
    categoryId: "commerce",
    status: "Draft",
    icon: mdi.mdiCartCheck,
  },
  {
    id: "campaign-insights",
    name: "Campaign Insights",
    description: "Track campaign engagement and channel conversion trends.",
    priceLabel: "$69 / month",
    categoryId: "analytics",
    status: "Published",
    icon: mdi.mdiChartLine,
  },
  {
    id: "audience-segments",
    name: "Audience Segments",
    description: "Build smart customer segments using behavior and profile rules.",
    priceLabel: "$79 / month",
    categoryId: "analytics",
    status: "Draft",
    icon: mdi.mdiAccountGroupOutline,
  },
];
