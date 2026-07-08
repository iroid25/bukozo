export type Permission = {
  create: string;
  read: string;
  update: string;
  delete: string;
};

export type ModulePermissions = {
  display: string;
  name: string;
  permissions: Permission;
};

export const permissions: ModulePermissions[] = [
  // Dashboard
  {
    display: "Dashboard",
    name: "dashboard",
    permissions: {
      create: "dashboard.create",
      read: "dashboard.read",
      update: "dashboard.update",
      delete: "dashboard.delete",
    },
  },

  // User Management
  {
    display: "Users",
    name: "users",
    permissions: {
      create: "users.create",
      read: "users.read",
      update: "users.update",
      delete: "users.delete",
    },
  },
  {
    display: "Roles",
    name: "roles",
    permissions: {
      create: "roles.create",
      read: "roles.read",
      update: "roles.update",
      delete: "roles.delete",
    },
  },
  {
    display: "Loans",
    name: "loans",
    permissions: {
      create: "loans.create",
      read: "loans.read",
      update: "loans.update",
      delete: "loans.delete",
    },
  },
  {
    display: "Deposits",
    name: "deposits",
    permissions: {
      create: "deposits.create",
      read: "deposits.read",
      update: "deposits.update",
      delete: "deposits.delete",
    },
  },
  {
    display: "Withdraws",
    name: "withdraws",
    permissions: {
      create: "withdraws.create",
      read: "withdraws.read",
      update: "withdraws.update",
      delete: "withdraws.delete",
    },
  },
  {
    display: "Reminders",
    name: "reminders",
    permissions: {
      create: "reminders.create",
      read: "reminders.read",
      update: "reminders.update",
      delete: "reminders.delete",
    },
  },
  {
    display: "Logs",
    name: "logs",
    permissions: {
      create: "logs.create",
      read: "logs.read",
      update: "logs.update",
      delete: "logs.delete",
    },
  },

  // Inventory Management
  {
    display: "Inventory",
    name: "inventory",
    permissions: {
      create: "inventory.create",
      read: "inventory.read",
      update: "inventory.update",
      delete: "inventory.delete",
    },
  },
  {
    display: "Items",
    name: "items",
    permissions: {
      create: "items.create",
      read: "items.read",
      update: "items.update",
      delete: "items.delete",
    },
  },
  {
    display: "Categories",
    name: "categories",
    permissions: {
      create: "categories.create",
      read: "categories.read",
      update: "categories.update",
      delete: "categories.delete",
    },
  },
  {
    display: "Brands",
    name: "brands",
    permissions: {
      create: "brands.create",
      read: "brands.read",
      update: "brands.update",
      delete: "brands.delete",
    },
  },
  {
    display: "Units",
    name: "units",
    permissions: {
      create: "units.create",
      read: "units.read",
      update: "units.update",
      delete: "units.delete",
    },
  },
  {
    display: "Stock",
    name: "stock",
    permissions: {
      create: "stock.create",
      read: "stock.read",
      update: "stock.update",
      delete: "stock.delete",
    },
  },
  {
    display: "Serial Numbers",
    name: "serial.numbers",
    permissions: {
      create: "serial.numbers.create",
      read: "serial.numbers.read",
      update: "serial.numbers.update",
      delete: "serial.numbers.delete",
    },
  },
  {
    display: "Transfers",
    name: "transfers",
    permissions: {
      create: "transfers.create",
      read: "transfers.read",
      update: "transfers.update",
      delete: "transfers.delete",
    },
  },
  {
    display: "Adjustments",
    name: "adjustments",
    permissions: {
      create: "adjustments.create",
      read: "adjustments.read",
      update: "adjustments.update",
      delete: "adjustments.delete",
    },
  },

  // Purchases
  {
    display: "Purchase Orders",
    name: "purchase.orders",
    permissions: {
      create: "purchase.orders.create",
      read: "purchase.orders.read",
      update: "purchase.orders.update",
      delete: "purchase.orders.delete",
    },
  },
  {
    display: "Goods Receipts",
    name: "goods.receipts",
    permissions: {
      create: "goods.receipts.create",
      read: "goods.receipts.read",
      update: "goods.receipts.update",
      delete: "goods.receipts.delete",
    },
  },
  {
    display: "Suppliers",
    name: "suppliers",
    permissions: {
      create: "suppliers.create",
      read: "suppliers.read",
      update: "suppliers.update",
      delete: "suppliers.delete",
    },
  },

  // Sales
  {
    display: "Sales",
    name: "sales",
    permissions: {
      create: "sales.create",
      read: "sales.read",
      update: "sales.update",
      delete: "sales.delete",
    },
  },
  {
    display: "Sales Orders",
    name: "sales.orders",
    permissions: {
      create: "sales.orders.create",
      read: "sales.orders.read",
      update: "sales.orders.update",
      delete: "sales.orders.delete",
    },
  },
  {
    display: "Customers",
    name: "customers",
    permissions: {
      create: "customers.create",
      read: "customers.read",
      update: "customers.update",
      delete: "customers.delete",
    },
  },
  {
    display: "POS",
    name: "pos",
    permissions: {
      create: "pos.create",
      read: "pos.access",
      update: "pos.update",
      delete: "pos.delete",
    },
  },
  {
    display: "Returns",
    name: "returns",
    permissions: {
      create: "returns.create",
      read: "returns.read",
      update: "returns.update",
      delete: "returns.delete",
    },
  },

  // Reports
  {
    display: "Reports",
    name: "reports",
    permissions: {
      create: "reports.create",
      read: "reports.read",
      update: "reports.update",
      delete: "reports.delete",
    },
  },
  {
    display: "Inventory Reports",
    name: "reports.inventory",
    permissions: {
      create: "reports.inventory.create",
      read: "reports.inventory.read",
      update: "reports.inventory.update",
      delete: "reports.inventory.delete",
    },
  },
  {
    display: "Purchase Reports",
    name: "reports.purchases",
    permissions: {
      create: "reports.purchases.create",
      read: "reports.purchases.read",
      update: "reports.purchases.update",
      delete: "reports.purchases.delete",
    },
  },
  {
    display: "Sales Reports",
    name: "reports.sales",
    permissions: {
      create: "reports.sales.create",
      read: "reports.sales.read",
      update: "reports.sales.update",
      delete: "reports.sales.delete",
    },
  },
  {
    display: "Product Reports",
    name: "reports.products",
    permissions: {
      create: "reports.products.create",
      read: "reports.products.read",
      update: "reports.products.update",
      delete: "reports.products.delete",
    },
  },
  {
    display: "Supplier Reports",
    name: "reports.suppliers",
    permissions: {
      create: "reports.suppliers.create",
      read: "reports.suppliers.read",
      update: "reports.suppliers.update",
      delete: "reports.suppliers.delete",
    },
  },
  {
    display: "Customer Reports",
    name: "reports.customers",
    permissions: {
      create: "reports.customers.create",
      read: "reports.customers.read",
      update: "reports.customers.update",
      delete: "reports.customers.delete",
    },
  },

  // Integrations
  {
    display: "Integrations",
    name: "integrations",
    permissions: {
      create: "integrations.create",
      read: "integrations.access",
      update: "integrations.update",
      delete: "integrations.delete",
    },
  },
  {
    display: "POS Integration",
    name: "integrations.pos",
    permissions: {
      create: "integrations.pos.create",
      read: "integrations.pos.access",
      update: "integrations.pos.update",
      delete: "integrations.pos.delete",
    },
  },
  {
    display: "Accounting Integration",
    name: "integrations.accounting",
    permissions: {
      create: "integrations.accounting.create",
      read: "integrations.accounting.access",
      update: "integrations.accounting.update",
      delete: "integrations.accounting.delete",
    },
  },
  {
    display: "API Settings",
    name: "integrations.api",
    permissions: {
      create: "integrations.api.create",
      read: "integrations.api.access",
      update: "integrations.api.update",
      delete: "integrations.api.delete",
    },
  },
  {
    display: "E-commerce Integration",
    name: "integrations.ecommerce",
    permissions: {
      create: "integrations.ecommerce.create",
      read: "integrations.ecommerce.access",
      update: "integrations.ecommerce.update",
      delete: "integrations.ecommerce.delete",
    },
  },

  // Settings
  {
    display: "Settings",
    name: "settings",
    permissions: {
      create: "settings.create",
      read: "settings.access",
      update: "settings.update",
      delete: "settings.delete",
    },
  },
  {
    display: "Locations",
    name: "locations",
    permissions: {
      create: "locations.create",
      read: "locations.read",
      update: "locations.update",
      delete: "locations.delete",
    },
  },
  {
    display: "Company Settings",
    name: "company.settings",
    permissions: {
      create: "company.settings.create",
      read: "company.settings.access",
      update: "company.settings.update",
      delete: "company.settings.delete",
    },
  },
  {
    display: "Tax Rates",
    name: "tax.settings",
    permissions: {
      create: "tax.settings.create",
      read: "tax.settings.access",
      update: "tax.settings.update",
      delete: "tax.settings.delete",
    },
  },
  {
    display: "Profile",
    name: "profile",
    permissions: {
      create: "profile.create",
      read: "profile.read",
      update: "profile.update",
      delete: "profile.delete",
    },
  },
  {
    display: "Password",
    name: "password",
    permissions: {
      create: "password.create",
      read: "password.read",
      update: "password.change",
      delete: "password.delete",
    },
  },
  {
    display: "API Keys",
    name: "api.keys",
    permissions: {
      create: "api.keys.create",
      read: "api.keys.read",
      update: "api.keys.update",
      delete: "api.keys.delete",
    },
  },

  // Content Management
  {
    display: "Blogs",
    name: "blogs",
    permissions: {
      create: "blogs.create",
      read: "blogs.read",
      update: "blogs.update",
      delete: "blogs.delete",
    },
  },
  {
    display: "Blog Categories",
    name: "blog.categories",
    permissions: {
      create: "blog.categories.create",
      read: "blog.categories.read",
      update: "blog.categories.update",
      delete: "blog.categories.delete",
    },
  },

  // Legacy modules kept for backward compatibility
  {
    display: "Products",
    name: "products",
    permissions: {
      create: "products.create",
      read: "products.read",
      update: "products.update",
      delete: "products.delete",
    },
  },
  {
    display: "Orders",
    name: "orders",
    permissions: {
      create: "orders.create",
      read: "orders.read",
      update: "orders.update",
      delete: "orders.delete",
    },
  },
];

export const adminPermissions = [
  // Dashboard
  "dashboard.create",
  "dashboard.read",
  "dashboard.update",
  "dashboard.delete",

  // User Management
  "users.create",
  "users.read",
  "users.update",
  "users.delete",
  "roles.create",
  "roles.read",
  "roles.update",
  "roles.delete",

  // Inventory Management
  "inventory.read",
  "items.create",
  "items.read",
  "items.update",
  "items.delete",
  "categories.create",
  "categories.read",
  "categories.update",
  "categories.delete",
  "brands.create",
  "brands.read",
  "brands.update",
  "brands.delete",
  "units.create",
  "units.read",
  "units.update",
  "units.delete",
  "stock.create",
  "stock.read",
  "stock.update",
  "stock.delete",
  "serial.numbers.create",
  "serial.numbers.read",
  "serial.numbers.update",
  "serial.numbers.delete",
  "transfers.create",
  "transfers.read",
  "transfers.update",
  "transfers.delete",
  "adjustments.create",
  "adjustments.read",
  "adjustments.update",
  "adjustments.delete",

  // Purchases
  "purchase.orders.create",
  "purchase.orders.read",
  "purchase.orders.update",
  "purchase.orders.delete",
  "goods.receipts.create",
  "goods.receipts.read",
  "goods.receipts.update",
  "goods.receipts.delete",
  "suppliers.create",
  "suppliers.read",
  "suppliers.update",
  "suppliers.delete",

  // Sales
  "sales.create",
  "sales.read",
  "sales.update",
  "sales.delete",
  "sales.orders.create",
  "sales.orders.read",
  "sales.orders.update",
  "sales.orders.delete",
  "pos.create",
  "pos.access",
  "pos.update",
  "pos.delete",
  "returns.create",
  "returns.read",
  "returns.update",
  "returns.delete",
  "customers.create",
  "customers.read",
  "customers.update",
  "customers.delete",

  // Reports
  "reports.create",
  "reports.read",
  "reports.update",
  "reports.delete",
  "reports.inventory.create",
  "reports.inventory.read",
  "reports.inventory.update",
  "reports.inventory.delete",
  "reports.purchases.create",
  "reports.purchases.read",
  "reports.purchases.update",
  "reports.purchases.delete",
  "reports.sales.create",
  "reports.sales.read",
  "reports.sales.update",
  "reports.sales.delete",
  "reports.products.create",
  "reports.products.read",
  "reports.products.update",
  "reports.products.delete",

  // Integrations
  "integrations.create",
  "integrations.access",
  "integrations.update",
  "integrations.delete",
  "integrations.pos.create",
  "integrations.pos.access",
  "integrations.pos.update",
  "integrations.pos.delete",
  "integrations.accounting.create",
  "integrations.accounting.access",
  "integrations.accounting.update",
  "integrations.accounting.delete",
  "integrations.api.create",
  "integrations.api.access",
  "integrations.api.update",
  "integrations.api.delete",

  // Settings
  "settings.create",
  "settings.access",
  "settings.update",
  "settings.delete",
  "locations.create",
  "locations.read",
  "locations.update",
  "locations.delete",
  "company.settings.create",
  "company.settings.access",
  "company.settings.update",
  "company.settings.delete",
  "profile.create",
  "profile.read",
  "profile.update",
  "profile.delete",
  "password.create",
  "password.read",
  "password.change",
  "password.delete",

  // Legacy permissions kept for backward compatibility
  "products.create",
  "products.read",
  "products.update",
  "products.delete",
  "orders.create",
  "orders.read",
  "orders.update",
  "orders.delete",
  "blogs.create",
  "blogs.read",
  "blogs.update",
  "blogs.delete",
];

export const userPermissions = [
  // Basic user permissions
  "dashboard.read",
  "profile.read",
  "profile.update",
  "password.change",

  // Inventory view access
  "items.read",
  "categories.read",
  "brands.read",
  "units.read",
  "stock.read",

  // Basic sales capabilities
  "sales.orders.read",
  "sales.orders.create",
  "pos.access",
  "customers.read",

  // Legacy permissions for backward compatibility
  "products.read",
  "orders.read",
  "orders.create",
];

export const managerPermissions = [
  // All user permissions
  ...userPermissions,

  // Inventory management
  "items.create",
  "items.update",
  "categories.read",
  "brands.read",
  "units.read",
  "stock.update",
  "transfers.create",
  "transfers.read",
  "adjustments.create",
  "adjustments.read",

  // Purchase management
  "purchase.orders.create",
  "purchase.orders.read",
  "purchase.orders.update",
  "goods.receipts.create",
  "goods.receipts.read",
  "suppliers.read",

  // Enhanced sales capabilities
  "sales.create",
  "sales.update",
  "sales.orders.update",
  "returns.create",
  "returns.read",
  "customers.create",
  "customers.update",

  // Basic reporting
  "reports.read",
  "reports.inventory.read",
  "reports.sales.read",
  "reports.products.read",

  // Legacy permissions
  "products.create",
  "products.update",
];

// Helper function to get all permission strings
export function getAllPermissions(): string[] {
  return permissions.flatMap((module) => Object.values(module.permissions));
}

// Helper function to check if a permission exists
export function isValidPermission(permission: string): boolean {
  return getAllPermissions().includes(permission);
}

// Helper to get module permissions by name
export function getModulePermissions(
  moduleName: string
): Permission | undefined {
  const module = permissions.find((m) => m.name === moduleName);
  return module?.permissions;
}

// Type for the permissions object
export type PermissionsType = {
  [K in (typeof permissions)[number]["name"]]: Permission;
};
