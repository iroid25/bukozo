// config/sidebar.ts
import {
  BaggageClaim,
  BarChart2,
  BarChart4,
  Book,
  Cable,
  CircleDollarSign,
  FolderTree,
  Home,
  LucideIcon,
  Presentation,
  Settings,
  Users,
  ShoppingCart,
  Box,
  Repeat,
  FileEdit,
  Link,
  Store,
  UserCog,
  Building,
  DollarSign,
} from "lucide-react";

export interface ISidebarLink {
  title: string;
  href?: string;
  icon: LucideIcon;
  dropdown: boolean;
  permission: string; // Required permission to view this item
  dropdownMenu?: MenuItem[];
}

type MenuItem = {
  title: string;
  href: string;
  permission: string; // Required permission to view this menu item
};

export const sidebarLinks: ISidebarLink[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    dropdown: false,
    permission: "dashboard.read",
  },
  {
    title: "Withdraws",
    href: "/dashboard/withdraws",
    icon: DollarSign,
    dropdown: false,
    permission: "withdraws.read",
  },
  {
    title: "Inventory",
    icon: BaggageClaim,
    dropdown: true,
    href: "/dashboard/inventory/items",
    permission: "inventory.read",
    dropdownMenu: [
      {
        title: "Items",
        href: "/dashboard/inventory/items",
        permission: "items.read",
      },
      {
        title: "Categories",
        href: "/dashboard/inventory/categories",
        permission: "categories.read",
      },
      {
        title: "Brands",
        href: "/dashboard/inventory/brands",
        permission: "brands.read",
      },
      {
        title: "Units",
        href: "/dashboard/inventory/units",
        permission: "units.read",
      },
      {
        title: "Current Stock",
        href: "/dashboard/inventory/stock",
        permission: "stock.read",
      },
      {
        title: "Low Stock Items",
        href: "/dashboard/inventory/stock/low-stock",
        permission: "stock.read",
      },
      {
        title: "Serial Numbers",
        href: "/dashboard/inventory/serial-numbers",
        permission: "serial.numbers.read",
      },
      {
        title: "Stock Transfers",
        href: "/dashboard/inventory/transfers",
        permission: "transfers.read",
      },
      {
        title: "Stock Adjustments",
        href: "/dashboard/inventory/adjustments",
        permission: "adjustments.read",
      },
    ],
  },
  {
    title: "Purchases",
    icon: ShoppingCart,
    dropdown: true,
    href: "/dashboard/purchases/orders",
    permission: "purchases.read",
    dropdownMenu: [
      {
        title: "Purchase Orders",
        href: "/dashboard/purchases/orders",
        permission: "purchase.orders.read",
      },
      {
        title: "Create Purchase Order",
        href: "/dashboard/purchases/orders/create",
        permission: "purchase.orders.create",
      },
      {
        title: "Goods Receipt",
        href: "/dashboard/purchases/receipts",
        permission: "goods.receipts.read",
      },
      {
        title: "Create Receipt",
        href: "/dashboard/purchases/receipts/create",
        permission: "goods.receipts.create",
      },
      {
        title: "Suppliers",
        href: "/dashboard/purchases/suppliers",
        permission: "suppliers.read",
      },
      {
        title: "Add Supplier",
        href: "/dashboard/purchases/suppliers/create",
        permission: "suppliers.create",
      },
    ],
  },
  {
    title: "Sales",
    icon: CircleDollarSign,
    dropdown: true,
    href: "/dashboard/sales/orders",
    permission: "sales.read",
    dropdownMenu: [
      {
        title: "POS Sales",
        href: "/dashboard/sales/pos",
        permission: "pos.access",
      },
      {
        title: "Sales Orders",
        href: "/dashboard/sales/orders",
        permission: "sales.orders.read",
      },
      {
        title: "Create Sales Order",
        href: "/dashboard/sales/orders/create",
        permission: "sales.orders.create",
      },
      {
        title: "Returns",
        href: "/dashboard/sales/returns",
        permission: "returns.read",
      },
      {
        title: "Create Return",
        href: "/dashboard/sales/returns/create",
        permission: "returns.create",
      },
      {
        title: "Customers",
        href: "/dashboard/sales/customers",
        permission: "customers.read",
      },
    ],
  },
  {
    title: "Reports",
    icon: BarChart4,
    dropdown: true,
    href: "/dashboard/reports/inventory",
    permission: "reports.read",
    dropdownMenu: [
      {
        title: "GL Account Performance",
        href: "/dashboard/reports/gl-performance",
        permission: "reports.read",
      },
      {
        title: "Stock Movement",
        href: "/dashboard/reports/inventory/movement",
        permission: "reports.inventory.read",
      },
      {
        title: "Inventory Valuation",
        href: "/dashboard/reports/inventory/valuation",
        permission: "reports.inventory.read",
      },
      {
        title: "Aging Analysis",
        href: "/dashboard/reports/inventory/aging",
        permission: "reports.inventory.read",
      },
      {
        title: "Purchase Summary",
        href: "/dashboard/reports/purchases/summary",
        permission: "reports.purchases.read",
      },
      {
        title: "Supplier Performance",
        href: "/dashboard/reports/purchases/supplier-performance",
        permission: "reports.purchases.read",
      },
      {
        title: "Sales Summary",
        href: "/dashboard/reports/sales/summary",
        permission: "reports.sales.read",
      },
      {
        title: "Product Performance",
        href: "/dashboard/reports/sales/product-performance",
        permission: "reports.products.read",
      },
    ],
  },
  {
    title: "Integrations",
    icon: Link,
    dropdown: true,
    href: "/dashboard/integrations/pos",
    permission: "integrations.access",
    dropdownMenu: [
      {
        title: "POS Integration",
        href: "/dashboard/integrations/pos",
        permission: "integrations.pos.access",
      },
      {
        title: "Accounting Integration",
        href: "/dashboard/integrations/accounting",
        permission: "integrations.accounting.access",
      },
      {
        title: "API Management",
        href: "/dashboard/integrations/api",
        permission: "integrations.api.access",
      },
    ],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    dropdown: true,
    permission: "settings.access",
    dropdownMenu: [
      {
        title: "Locations",
        href: "/dashboard/settings/locations",
        permission: "locations.read",
      },
      {
        title: "Add Location",
        href: "/dashboard/settings/locations/create",
        permission: "locations.create",
      },
      {
        title: "Tax Rates",
        href: "/dashboard/settings/tax-rates",
        permission: "tax.read",
      },
      {
        title: "Add Tax rate",
        href: "/dashboard/settings/tax-rates/create",
        permission: "tax.create",
      },
      {
        title: "Users & Invites",
        href: "/dashboard/settings/users",
        permission: "users.read",
      },
      {
        title: "Roles & Permissions",
        href: "/dashboard/settings/roles",
        permission: "roles.read",
      },
      {
        title: "Company Settings",
        href: "/dashboard/settings/company",
        permission: "company.settings.access",
      },
      {
        title: "Staff Limits",
        href: "/dashboard/settings/staff-limits",
        permission: "settings.access",
      },
      {
        title: "Audit Log",
        href: "/dashboard/settings/audit-log",
        permission: "settings.access",
      },
      {
        title: "Profile",
        href: "/dashboard/profile",
        permission: "profile.read",
      },
      {
        title: "Change Password",
        href: "/dashboard/settings/change-password",
        permission: "password.change",
      },
    ],
  },
];
