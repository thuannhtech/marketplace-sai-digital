import { PagePermissionConfig, RoleCategory } from "./auth-types";

/**
 * Standard list of 77 OrderCloud Roles
 */
export const ALL_ORDERCLOUD_ROLES = [
  "AddressAdmin",
  "AddressReader",
  "AdminAddressAdmin",
  "AdminAddressReader",
  "AdminUserAdmin",
  "AdminUserGroupAdmin",
  "AdminUserGroupReader",
  "AdminUserReader",
  "ApiClientAdmin",
  "ApiClientReader",
  "ApprovalRuleAdmin",
  "ApprovalRuleReader",
  "BuyerAdmin",
  "BuyerImpersonation",
  "BuyerReader",
  "BuyerUserAdmin",
  "BuyerUserReader",
  "CatalogAdmin",
  "CatalogReader",
  "CategoryAdmin",
  "CategoryReader",
  "CostCenterAdmin",
  "CostCenterReader",
  "CreditCardAdmin",
  "CreditCardReader",
  "FullAccess",
  "IncrementorAdmin",
  "IncrementorReader",
  "IntegrationEventAdmin",
  "IntegrationEventReader",
  "InventoryAdmin",
  "LocaleAdmin",
  "LocaleReader",
  "MeAddressAdmin",
  "MeAdmin",
  "MeCreditCardAdmin",
  "MessageConfigAssignmentAdmin",
  "MessageSenderAdmin",
  "MessageSenderReader",
  "MeXpAdmin",
  "OpenIDConnectAdmin",
  "OpenIDConnectReader",
  "OrderAdmin",
  "OrderReader",
  "OverrideShipping",
  "OverrideTax",
  "OverrideUnitPrice",
  "PasswordReset",
  "PriceScheduleAdmin",
  "PriceScheduleReader",
  "ProductAdmin",
  "ProductAssignmentAdmin",
  "ProductFacetAdmin",
  "ProductFacetReader",
  "ProductReader",
  "PromotionAdmin",
  "PromotionReader",
  "SecurityProfileAdmin",
  "SecurityProfileReader",
  "SetSecurityProfile",
  "ShipmentAdmin",
  "ShipmentReader",
  "Shopper",
  "SpendingAccountAdmin",
  "SpendingAccountReader",
  "SupplierAddressAdmin",
  "SupplierAddressReader",
  "SupplierAdmin",
  "SupplierReader",
  "SupplierUserAdmin",
  "SupplierUserGroupAdmin",
  "SupplierUserGroupReader",
  "SupplierUserReader",
  "TrackingEventAdmin",
  "TrackingEventReader",
  "UnsubmittedOrderReader",
  "UserGroupAdmin",
  "UserGroupReader",
  "WebhookAdmin",
  "WebhookReader",
  "XpIndexAdmin",
] as const;

export type OrderCloudRole = (typeof ALL_ORDERCLOUD_ROLES)[number];

/**
 * Categorization of 77 OrderCloud roles into functional categories
 */
export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    name: "System & Security",
    description: "System administration, security profiles, API clients, webhooks, and Super Admin access",
    roles: [
      "FullAccess",
      "SecurityProfileAdmin",
      "SecurityProfileReader",
      "SetSecurityProfile",
      "AdminUserAdmin",
      "AdminUserReader",
      "AdminUserGroupAdmin",
      "AdminUserGroupReader",
      "ApiClientAdmin",
      "ApiClientReader",
      "OpenIDConnectAdmin",
      "OpenIDConnectReader",
      "WebhookAdmin",
      "WebhookReader",
      "IntegrationEventAdmin",
      "IntegrationEventReader",
      "MessageConfigAssignmentAdmin",
      "MessageSenderAdmin",
      "MessageSenderReader",
      "XpIndexAdmin",
      "TrackingEventAdmin",
      "TrackingEventReader",
    ],
  },
  {
    name: "Products & Catalog",
    description: "Product management, catalogs, categories, price schedules, and inventory",
    roles: [
      "ProductAdmin",
      "ProductReader",
      "ProductAssignmentAdmin",
      "ProductFacetAdmin",
      "ProductFacetReader",
      "CatalogAdmin",
      "CatalogReader",
      "CategoryAdmin",
      "CategoryReader",
      "PriceScheduleAdmin",
      "PriceScheduleReader",
      "InventoryAdmin",
    ],
  },
  {
    name: "Orders & Fulfillment",
    description: "Order management, shipments, tax/price overrides, and fulfillment",
    roles: [
      "OrderAdmin",
      "OrderReader",
      "UnsubmittedOrderReader",
      "ShipmentAdmin",
      "ShipmentReader",
      "OverrideUnitPrice",
      "OverrideShipping",
      "OverrideTax",
    ],
  },
  {
    name: "Customers & Buyers",
    description: "Customer accounts, buyer organizations, buyer user groups, and impersonation",
    roles: [
      "BuyerAdmin",
      "BuyerReader",
      "BuyerUserAdmin",
      "BuyerUserReader",
      "BuyerImpersonation",
      "UserGroupAdmin",
      "UserGroupReader",
      "Shopper",
    ],
  },
  {
    name: "Promotions",
    description: "Promotional campaigns, discounts, and coupon management",
    roles: ["PromotionAdmin", "PromotionReader"],
  },
  {
    name: "Me & Profiles",
    description: "Current user profile, addresses, locale settings, and password reset",
    roles: [
      "MeAdmin",
      "MeAddressAdmin",
      "MeCreditCardAdmin",
      "MeXpAdmin",
      "AddressAdmin",
      "AddressReader",
      "AdminAddressAdmin",
      "AdminAddressReader",
      "LocaleAdmin",
      "LocaleReader",
      "PasswordReset",
    ],
  },
];

/**
 * Role permission configuration for core pages
 * Strictly checks user.xp.Roles (created via Admin User Role Presets)
 */
export const PAGE_PERMISSIONS: Record<string, PagePermissionConfig> = {
  "/product": {
    read: ["ADMIN_CONTENTPRODUCT", "ADMIN_AWAITINGAPPROVAL", "ADMIN_PRODUCT_READER"],
    write: ["ADMIN_CONTENTPRODUCT"],
    approve: ["ADMIN_AWAITINGAPPROVAL"],
  },
  "/orders": {
    read: ["COUNTRY_ORDER_EDITOR", "COUNTRY_ORDER_READER"],
    write: ["COUNTRY_ORDER_EDITOR"],
  },
  "/customers": {
    read: ["COUNTRY_CUSTOMER_EDITOR", "COUNTRY_CUSTOMER_MANAGER", "COUNTRY_CUSTOMER_READER"],
    write: ["COUNTRY_CUSTOMER_EDITOR"],
  },
  "/promotions": {
    read: ["COUNTRY_MARKETING_EDITOR", "COUNTRY_MARKETING_READER"],
    write: ["COUNTRY_MARKETING_EDITOR"],
  },
  "/gst-configuration": {
    read: ["COUNTRY_TAX_CONFIG"],
    write: ["COUNTRY_TAX_CONFIG"],
  },
};

/**
 * Functional role preset definition for page-level access (Read Only vs Editor)
 */
export interface RolePreset {
  id: string;
  name: string;
  description: string;
  category: "Super Admin" | "Customers" | "Products" | "Orders" | "Promotions" | "Tax / GST";
  type: "admin" | "reader" | "approver";
  xpRole: string; // Stored in user.xp.Roles (e.g. COUNTRY_CUSTOMER_EDITOR)
  roles: readonly string[]; // Standard OrderCloud roles
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Complete unrestricted access across all modules (FullAccess & SUPPER_ADMIN)",
    category: "Super Admin",
    type: "admin",
    xpRole: "SUPPER_ADMIN",
    roles: ["FullAccess"],
  },
  {
    id: "customer_reader",
    name: "Customer Read Only",
    description: "Read customer profiles, buyer user details, and addresses",
    category: "Customers",
    type: "reader",
    xpRole: "COUNTRY_CUSTOMER_MANAGER",
    roles: ["BuyerReader", "BuyerUserReader"],
  },
  {
    id: "customer_editor",
    name: "Customer Editor",
    description: "Full management of customers, buyer companies, groups, and impersonation",
    category: "Customers",
    type: "admin",
    xpRole: "COUNTRY_CUSTOMER_EDITOR",
    roles: [
      "BuyerAdmin",
      "BuyerReader",
      "BuyerUserAdmin",
      "BuyerUserReader",
      "BuyerImpersonation",
      "UserGroupAdmin",
      "UserGroupReader",
    ],
  },
  {
    id: "product_reader",
    name: "Product Read Only",
    description: "View product catalog, categories, pricing schedules, and facets",
    category: "Products",
    type: "reader",
    xpRole: "ADMIN_PRODUCT_READER",
    roles: [
      "ProductReader",
      "CategoryReader",
      "CatalogReader",
      "PriceScheduleReader",
      "ProductFacetReader",
    ],
  },
  {
    id: "product_approver",
    name: "Product Approver",
    description: "Review and approve product models for Web database publishing",
    category: "Products",
    type: "approver",
    xpRole: "ADMIN_AWAITINGAPPROVAL",
    roles: [
      "ProductReader",
      "CategoryReader",
      "CatalogReader",
      "PriceScheduleReader",
      "ProductFacetReader",
    ],
  },
  {
    id: "product_editor",
    name: "Product Editor",
    description: "Full management of products, categories, catalogs, inventory, and pricing",
    category: "Products",
    type: "admin",
    xpRole: "ADMIN_CONTENTPRODUCT",
    roles: [
      "ProductAdmin",
      "ProductReader",
      "CatalogAdmin",
      "CatalogReader",
      "CategoryAdmin",
      "CategoryReader",
      "PriceScheduleAdmin",
      "PriceScheduleReader",
      "ProductFacetAdmin",
      "ProductFacetReader",
      "InventoryAdmin",
    ],
  },
  {
    id: "order_reader",
    name: "Order Read Only",
    description: "View orders, line items, shipments, and payment records",
    category: "Orders",
    type: "reader",
    xpRole: "COUNTRY_ORDER_READER",
    roles: ["OrderReader", "ShipmentReader", "CreditCardReader", "UnsubmittedOrderReader"],
  },
  {
    id: "order_editor",
    name: "Order Editor",
    description: "Process orders, cancel/confirm status, manage shipments and price overrides",
    category: "Orders",
    type: "admin",
    xpRole: "COUNTRY_ORDER_EDITOR",
    roles: [
      "OrderAdmin",
      "OrderReader",
      "ShipmentAdmin",
      "ShipmentReader",
      "CreditCardAdmin",
      "CreditCardReader",
      "OverrideUnitPrice",
      "OverrideShipping",
      "OverrideTax",
      "UnsubmittedOrderReader",
    ],
  },
  {
    id: "promotion_reader",
    name: "Promotion Read Only",
    description: "View promotions, discounts, coupon codes, and rules",
    category: "Promotions",
    type: "reader",
    xpRole: "COUNTRY_MARKETING_READER",
    roles: ["PromotionReader"],
  },
  {
    id: "promotion_editor",
    name: "Promotion Editor",
    description: "Create, edit, and manage discount campaigns, codes, and priority",
    category: "Promotions",
    type: "admin",
    xpRole: "COUNTRY_MARKETING_EDITOR",
    roles: ["PromotionAdmin", "PromotionReader"],
  },
  {
    id: "tax_editor",
    name: "Tax / GST Editor",
    description: "Manage GST rates, tax configuration, and taxation rules",
    category: "Tax / GST",
    type: "admin",
    xpRole: "COUNTRY_TAX_CONFIG",
    roles: ["OverrideTax"],
  },
];

/**
 * Given a user's active roles list and/or xpRoles, detect which friendly preset names they have
 * Strictly evaluated from xp.Roles
 */
export function getUserPresetNames(roles?: string[], xpRoles?: string[]): string[] {
  const activeRoles = xpRoles && xpRoles.length > 0 ? xpRoles : (roles || []);
  if (activeRoles.length === 0) return [];

  // Chỉ kiểm tra xp role = SUPPER_ADMIN cho Super Admin
  if (activeRoles.includes("SUPPER_ADMIN")) {
    return ["Super Admin"];
  }

  const presets: string[] = [];

  // Customers
  if (activeRoles.includes("COUNTRY_CUSTOMER_EDITOR")) {
    presets.push("Customer Editor");
  } else if (
    activeRoles.includes("COUNTRY_CUSTOMER_MANAGER") ||
    activeRoles.includes("COUNTRY_CUSTOMER_READER")
  ) {
    presets.push("Customer Read Only");
  }

  // Products
  if (activeRoles.includes("ADMIN_CONTENTPRODUCT")) {
    presets.push("Product Editor");
  }
  if (activeRoles.includes("ADMIN_AWAITINGAPPROVAL")) {
    presets.push("Product Approver");
  }
  if (activeRoles.includes("ADMIN_PRODUCT_READER")) {
    presets.push("Product Read Only");
  }

  // Orders
  if (activeRoles.includes("COUNTRY_ORDER_EDITOR")) {
    presets.push("Order Editor");
  } else if (activeRoles.includes("COUNTRY_ORDER_READER")) {
    presets.push("Order Read Only");
  }

  // Promotions
  if (activeRoles.includes("COUNTRY_MARKETING_EDITOR")) {
    presets.push("Promotion Editor");
  } else if (activeRoles.includes("COUNTRY_MARKETING_READER")) {
    presets.push("Promotion Read Only");
  }

  // Tax / GST
  if (activeRoles.includes("COUNTRY_TAX_CONFIG")) {
    presets.push("Tax / GST Editor");
  }

  return presets;
}
