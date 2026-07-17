// config/routes.ts

import {
  Home,
  LayoutDashboard,
  Aperture,
  Anchor,
  Award,
  Baby,
  Binoculars,
  Brain,
  Users,
  UsersRound,
  UserCog,
  UserPlus,
  UserCheck,
  UserCircle2,
  Building,
  Building2,
  BusFront,
  Camera,
  CalendarCheck2,
  Landmark,
  Castle,
  ChartColumn,
  CigaretteOff,
  ClipboardPenLine,
  CloudCog,
  Coffee,
  PiggyBank,
  Coins,
  Wallet,
  HandCoins,
  BadgeDollarSign,
  Calculator,
  ScrollText,
  Smartphone,
  LineChart,
  BellRing,
  Settings,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShoppingCart,
  BookOpenCheck,
  CircleDollarSign,
  Handshake,
  FileBadge,
  TrendingUp,
  CreditCard,
  History,
  ClipboardList,
  Mail,
  MessageSquareText,
  Compass,
  Database,
  Diamond,
  DoorOpen,
  Droplets,
  FileText,
  Banknote,
  Lock,
  AlertTriangle,
  Fingerprint,
  BriefcaseBusiness,
  Archive,
  PieChart,
  Scale,
  Repeat,
  Layers3,
  Target,
  Activity,
  ReceiptText,
  FileCheck,
  FileBarChart,
  BadgeCheck,
  ArrowDownToLine,
  BarChart3,
  Egg,
  FileClock,
  Flame,
  Flower2,
  Gem,
  Ghost,
  Globe,
  Hammer,
  Headphones,
  HeartHandshake,
  Hexagon,
  KeyRound,
  Lightbulb,
  MapPinned,
  Mic,
  MonitorSmartphone,
  Mountain,
  NotebookPen,
  Orbit,
  Palette,
  ParkingCircle,
  Rocket,
  Sailboat,
  School,
  SearchCheck,
  Signal,
  Sparkles,
  Speaker,
  SquareArrowOutUpRight,
  Store,
  Tag,
  Ticket,
  TimerReset,
  TreePine,
  Triangle,
  University,
  Variable,
  Wrench,
  Zap,
  ZapOff,
  Goal,
  HardHat,
  Image,
  LifeBuoy,
  Medal,
  Package,
  PanelTop,
  Rat,
  Scan,
  Trophy,
  Umbrella,
  Vote,
  Waypoints,
} from "lucide-react";

// Assuming UserRoleType enum is available globally or imported
// from your Prisma generated client if using a shared type file
// import { UserRoleType } from "@prisma/client";

// Define UserRoleType to avoid dependency if not directly imported
export enum UserRoleType {
  ADMIN = "ADMIN",
  BRANCHMANAGER = "BRANCHMANAGER",
  TELLER = "TELLER",
  AGENT = "AGENT",
  MEMBER = "MEMBER",
  LOANOFFICER = "LOANOFFICER",
  AUDITOR = "AUDITOR",
  ACCOUNTANT = "ACCOUNTANT",
  INSTITUTION = "INSTITUTION",
  DATA_ENTRANT = "DATA_ENTRANT",
}

export type RouteSubLink = {
  title: string;
  href: string;
  icon?: any;
};

export type Route = {
  title: string;
  href: string;
  icon: any;
  roles?: UserRoleType[]; // Which roles can access this route
  group?: string; // Optional grouping for related routes
  isNew?: boolean; // Optional flag for new features
  subLinks?: RouteSubLink[]; // Indexed features & deep links mapped to this route
};

const uniqueIconPool = [
  Aperture,
  Anchor,
  Award,
  Baby,
  Binoculars,
  Brain,
  BusFront,
  Camera,
  CalendarCheck2,
  Castle,
  ChartColumn,
  CigaretteOff,
  ClipboardPenLine,
  CloudCog,
  Coffee,
  Compass,
  Database,
  Diamond,
  DoorOpen,
  Droplets,
  Egg,
  FileClock,
  Flame,
  Flower2,
  Gem,
  Ghost,
  Globe,
  Hammer,
  Headphones,
  HeartHandshake,
  Hexagon,
  KeyRound,
  Lightbulb,
  MapPinned,
  Mic,
  MonitorSmartphone,
  Mountain,
  NotebookPen,
  Orbit,
  Palette,
  ParkingCircle,
  Rocket,
  Sailboat,
  School,
  SearchCheck,
  ShieldAlert,
  Signal,
  Sparkles,
  Speaker,
  SquareArrowOutUpRight,
  Store,
  Tag,
  Ticket,
  TimerReset,
  TreePine,
  Triangle,
  University,
  Variable,
  Wrench,
  Zap,
  ZapOff,
  Goal,
  HardHat,
  Image,
  LifeBuoy,
  Medal,
  Package,
  PanelTop,
  Rat,
  Scan,
  Trophy,
  Umbrella,
  Vote,
  Waypoints,
];

const ensureUniqueIcons = (items: Route[]) => {
  const used = new Set<any>();
  let poolIndex = 0;

  const takeReplacementIcon = () => {
    while (poolIndex < uniqueIconPool.length && used.has(uniqueIconPool[poolIndex])) {
      poolIndex += 1;
    }

    const icon = uniqueIconPool[poolIndex];
    if (!icon) return undefined;

    used.add(icon);
    poolIndex += 1;
    return icon;
  };

  const takeIcon = (preferred?: any) => {
    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }

    const replacement = takeReplacementIcon();
    if (replacement) return replacement;

    if (preferred) {
      used.add(preferred);
      return preferred;
    }

    return undefined;
  };

  return items.map((route) => ({
    ...route,
    icon: takeIcon(route.icon),
    subLinks: route.subLinks?.map((subLink) => ({
      ...subLink,
      icon: takeIcon(subLink.icon),
    })),
  }));
};

const baseRoutes: Route[] = [
  // Dashboard - accessible to all relevant users
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      UserRoleType.LOANOFFICER,
      UserRoleType.AUDITOR,
      UserRoleType.ACCOUNTANT,
      UserRoleType.DATA_ENTRANT,

      UserRoleType.MEMBER,
    ],
  },

  // User Management
  {
    title: "Tellers",
    href: "/dashboard/users/tellers",
    icon: UserCheck,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
    subLinks: [
      { title: "Create Teller", href: "/dashboard/users/tellers/new" },
      {
        title: "View Teller Performance",
        href: "/dashboard/analytics/tellers",
      },
    ],
  },

  {
    title: "Agents",
    href: "/dashboard/users/agents",
    icon: UsersRound,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Branch Managers",
    href: "/dashboard/users/branchmanagers",
    icon: UserCog,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Loan Officer",
    href: "/dashboard/users/loanofficers",
    icon: BriefcaseBusiness,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Accountant",
    href: "/dashboard/users/accountants",
    icon: Calculator,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Auditors",
    href: "/dashboard/users/auditors",
    icon: BadgeCheck,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Data Entrants",
    href: "/dashboard/users/dataentrants",
    icon: UserCircle2,
    roles: [UserRoleType.ADMIN],
    group: "User Management",
  },
  {
    title: "Members",
    href: "/dashboard/users/members",
    icon: UserPlus,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.DATA_ENTRANT,
      // UserRoleType.AGENT,
    ],
    group: "User Management",
    subLinks: [
      { title: "Register New Member", href: "/dashboard/users/members/" },
      { title: "Search Members", href: "/dashboard/users/members" },
    ],
  },
  {
    title: "Institutions",
    href: "/dashboard/users/institutions",
    icon: Building2,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.DATA_ENTRANT,
      // UserRoleType.AGENT,
    ],
    group: "User Management",
  },
  // {
  //   title: "Roles & Permissions",
  //   href: "/dashboard/users/permissions",
  //   icon: ShieldCheck,
  //   roles: [UserRoleType.ADMIN],
  //   group: "User Management",
  // },

  // Branches
  {
    title: "Branches",
    href: "/dashboard/branches",
    icon: Landmark,
    roles: [UserRoleType.ADMIN],
    group: "System Configuration",
  },

  // Account Management
  {
    title: "Member Accounts",
    href: "/dashboard/accounts",
    icon: Wallet,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
      UserRoleType.DATA_ENTRANT,
    ],
    group: "Account Management",
  },
  {
    title: "Accounts by Type",
    href: "/dashboard/accounts/by-type",
    icon: Layers3,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
      UserRoleType.DATA_ENTRANT,
    ],
    group: "Account Management",
  },
  {
    title: "Penalty Collections",
    href: "/dashboard/accounts/penalty-collection",
    icon: AlertTriangle,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Account Management",
  },
  {
    title: "Insurance Pool",
    href: "/dashboard/insurance/pool",
    icon: ShieldCheck,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Chart of Accounts",
    href: "/dashboard/accounting/chart-of-accounts",
    icon: FileBarChart,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.ACCOUNTANT,
      // UserRoleType.MEMBER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Account Management",
  },
  {
    title: "Fixed Deposits",
    href: "/dashboard/accounts/fixed-deposits",
    icon: PiggyBank,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Suspense Account",
    href: "/dashboard/accounts/suspense",
    icon: CircleDollarSign,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      UserRoleType.ACCOUNTANT,
      // UserRoleType.LOANOFFICER,
    ],
    group: "Account Management",
  },
  {
    title: "Accounts Configurations",
    href: "/dashboard/accounts/configurations",
    icon: Settings,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "System Configuration",
  },
  {
    title: "Account Types",
    href: "/dashboard/account-types",
    icon: BookOpenCheck,
    roles: [UserRoleType.ADMIN],
    group: "System Configuration",
  },
  {
    title: "Fee Configurations 💰",
    href: "/dashboard/settings/fees",
    icon: CircleDollarSign,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "System Configuration",
  },
  {
    title: "Expenditure Categories",
    href: "/dashboard/settings/expenditure-categories",
    icon: Settings,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "System Configuration",
  },
  {
    title: "Interest Configuration",
    href: "/dashboard/settings/interest-config",
    icon: Calculator,
    roles: [UserRoleType.ADMIN],
    group: "System Configuration",
  },
  {
    title: "Withdrawal Configuration",
    href: "/dashboard/settings/withdrawal-config",
    icon: Banknote,
    roles: [UserRoleType.ADMIN],
    group: "System Configuration",
  },
  {
    title: "Staff Limits",
    href: "/dashboard/settings/staff-limits",
    icon: Shield,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "System Configuration",
  },
  {
    title: "Deposits",
    href: "/dashboard/deposits",
    icon: ArrowDownToLine,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      // UserRoleType.MEMBER,
    ],
    group: "Account Management",
  },
  // {
  //   title: "Withdrawals",
  //   href: "/dashboard/withdrawals",
  //   icon: Banknote,
  //   roles: [
  //     UserRoleType.ADMIN,
  //     UserRoleType.BRANCHMANAGER,
  //     UserRoleType.TELLER,
  //     // UserRoleType.AGENT,
  //     // UserRoleType.MEMBER,
  //   ],
  //   group: "Account Management",
  // },
  {
    title: "Withdrawals",
    href: "/dashboard/withdraw-test",
    icon: Banknote,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      // UserRoleType.MEMBER,
    ],
    group: "Account Management",
  },
  {
    title: "Account Holds",
    href: "/dashboard/holds",
    icon: Archive,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "System Guide",
    href: "/dashboard/help",
    icon: BookOpenCheck,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,

      UserRoleType.ACCOUNTANT,
      UserRoleType.LOANOFFICER,
      UserRoleType.AUDITOR,
    ],
    group: "System Configuration",
    isNew: true,
  },
  {
    title: "Fingerprint Diagnostic",
    href: "/dashboard/developer/fingerprint-diagnostic",
    icon: Fingerprint,
    roles: [UserRoleType.ADMIN],
    group: "Developer",
    isNew: true,
  },
  {
    title: "Fingerprint Test",
    href: "/fingerprint-test",
    icon: Fingerprint,
    roles: [UserRoleType.ADMIN],
    group: "Developer",
  },

  // Loan Management - Staff Specific
  {
    title: "Loan Applications",
    href: "/dashboard/loan-applications",
    icon: FileBadge,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Loan Management",
  },
  {
    title: "Manager Loan Approval",
    href: "/dashboard/loans/manager-loan-process-tracking",
    icon: ClipboardList,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Loan Management",
    isNew: true,
  },
  {
    title: "Disbursement Queue",
    href: "/dashboard/loanprocess/disbursement-queue",
    icon: BadgeDollarSign,
    roles: [
      // UserRoleType.ADMIN,
      // UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Loan Management",
  },
  {
    title: "Loan Processing & Tracking",
    href: "/dashboard/loanprocess/officer-tracking",
    icon: Target,
    roles: [
      UserRoleType.LOANOFFICER,
      UserRoleType.ADMIN,
      // UserRoleType.BRANCHMANAGER,
    ],
    group: "Loan Management",
  },
  {
    title: "My Loan Repayments ",
    href: "/dashboard/loan-repayments/my-repayments ",
    icon: FileBadge,
    roles: [UserRoleType.MEMBER],
    group: "Loan Management",
  },
  {
    title: "Active Loans",
    href: "/dashboard/loans",
    icon: Coins,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
      UserRoleType.MEMBER,
    ],
    group: "Loan Management",
  },
  {
    title: "Loan Migration",
    href: "/dashboard/loans/migrate",
    icon: Repeat,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Loan Management",
    isNew: true,
  },
  {
    title: "Loan Reschedules",
    href: "/dashboard/loans/reschedules",
    icon: History,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.LOANOFFICER,
    ],
    group: "Loan Management",
    isNew: true,
  },
  {
    title: "Loan Write offs",
    href: "/dashboard/loans/loan-write-offs",
    icon: Scale,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
      // UserRoleType.MEMBER,
    ],
    group: "Loan Management",
  },
  {
    title: "Loan Reports 💻",
    href: "/dashboard/loans/reports",
    icon: ScrollText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      UserRoleType.LOANOFFICER,
      // UserRoleType.MEMBER,
    ],
    group: "Loan Management",
  },
  {
    title: "Loan Processing & Tracking",
    href: "/dashboard/loanprocess/tracking",
    icon: Layers3,
    roles: [
      // UserRoleType.ADMIN,
      // // UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      // UserRoleType.LOANOFFICER,
      UserRoleType.MEMBER,
    ],
    group: "Loan Management",
  },
  {
    title: "Loan Repayments",
    href: "/dashboard/loan-repayments",
    icon: CreditCard,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,

      UserRoleType.LOANOFFICER,
    ],
    group: "Loan Management",
  },
  {
    title: "Income",
    href: "/dashboard/accounts/incomes",
    icon: ReceiptText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Assets",
    href: "/dashboard/accounts/assets",
    icon: Archive,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
    subLinks: [
      {
        title: "Register Fixed Asset",
        href: "/dashboard/accounts/assets?action=fixed",
      },
      {
        title: "Register Current Asset",
        href: "/dashboard/accounts/assets?action=current",
      },
      {
        title: "Transfer Asset",
        href: "/dashboard/accounts/assets?action=transfer",
      },
      {
        title: "Dispose / Transfer",
        href: "/dashboard/accounts/assets/dispose-transfer",
      },
    ],
  },
  {
    title: "Transfer & Disposal Requests",
    href: "/dashboard/accounts/assets/requests",
    icon: AlertTriangle,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Advance Requests",
    href: "/dashboard/accounts/advance-requests",
    icon: HandCoins,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
      UserRoleType.TELLER,
    ],
    group: "Account Management",
  },
  {
    title: "My Advances",
    href: "/dashboard/accounts/advance-requests/my",
    icon: HandCoins,
    roles: [
      UserRoleType.TELLER,
      UserRoleType.DATA_ENTRANT,
      UserRoleType.LOANOFFICER,
      UserRoleType.AUDITOR,
    ],
    group: "Account Management",
  },
  {
    title: "Liabilities",
    href: "/dashboard/accounts/liabilities",
    icon: PiggyBank,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Expenditures",
    href: "/dashboard/accounts/expenditures",
    icon: FileText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      // UserRoleType.MEMBER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Equity",
    href: "/dashboard/accounts/equity",
    icon: Coins,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Account Management",
  },
  {
    title: "Accounts Details",
    href: "/dashboard/member-details/accounts-details",
    icon: FileCheck,
    roles: [UserRoleType.MEMBER],
    group: "Account Management",
  },
  {
    title: "My Deposits",
    href: "/dashboard/member-details/deposit-details",
    icon: ArrowDownToLine,
    roles: [UserRoleType.MEMBER],
    group: "Account Management",
  },
  {
    title: "My Withdrawals",
    href: "/dashboard/member-details/my-withdrawals",
    icon: Banknote,
    roles: [UserRoleType.MEMBER],
    group: "Account Management",
  },
  {
    title: "My Transfers",
    href: "/dashboard/accounts/transfers/my-transfers",
    icon: Repeat,
    roles: [UserRoleType.MEMBER],
    group: "Account Management",
  },
  {
    title: "Transaction History",
    href: "/dashboard/transactions/my-transactions-history",
    icon: ScrollText,
    roles: [UserRoleType.MEMBER],
    group: "Account Management",
  },
  {
    title: "Loan Products",
    href: "/dashboard/loan-products",
    icon: Handshake,
    roles: [UserRoleType.ADMIN],
    group: "System Configuration",
  },

  {
    title: "Institution Loan Process",
    href: "/dashboard/loans/institution-loan-process-tracking",
    icon: Handshake,
    roles: [UserRoleType.INSTITUTION, UserRoleType.ADMIN],
    group: "System Configuration",
  },
  {
    title: "Institution Share Purchase",
    href: "/dashboard/shares/institution-purchase",
    icon: ShoppingCart,
    roles: [UserRoleType.ADMIN, UserRoleType.TELLER, UserRoleType.AGENT, UserRoleType.BRANCHMANAGER, UserRoleType.ACCOUNTANT],
    group: "System Configuration",
  },
  {
    title: "Sacco Reserve",
    href: "/dashboard/accounts/vault",
    icon: Wallet,
    roles: [UserRoleType.ADMIN],
    group: "RESERVE MANAGEMENT",
  },
  {
    title: "Branch Reserve",
    href: "/dashboard/reserve",
    icon: Wallet,
    roles: [
      UserRoleType.ACCOUNTANT,
      UserRoleType.BRANCHMANAGER,
    ],
    group: "RESERVE MANAGEMENT",
    isNew: true,
  },

  // Float Management
  {
    title: "Float Management",
    href: "/dashboard/floats",
    icon: Calculator,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Float Management",
  },
  {
    title: "Accountant Float Management",
    href: "/dashboard/floats/distribution",
    icon: BarChart3,
    roles: [UserRoleType.ACCOUNTANT],
    group: "Float Management",
  },
  {
    title: "Float Report",
    href: "/dashboard/floats/report",
    icon: FileBarChart,
    roles: [UserRoleType.ACCOUNTANT],
    group: "Float Management",
  },

  {
    title: "My Float",
    href: "/dashboard/floats/my-float",
    icon: Wallet,
    roles: [UserRoleType.TELLER, UserRoleType.AGENT],
    group: "Float Management",
  },
  // {
  //   title: "Float Allocations",
  //   href: "/dashboard/float-management/allocations",
  //   icon: Calculator, // Could use a more specific icon if available
  //   roles: [UserRoleType.ADMIN],
  //   group: "Float Management",
  // },
  // {
  //   title: "Float Transactions",
  //   href: "/dashboard/float-management/transactions",
  //   icon: History,
  //   roles: [
  //     UserRoleType.ADMIN,
  //     UserRoleType.BRANCHMANAGER,
  //     UserRoleType.TELLER,
  //     UserRoleType.AGENT,
  //   ],
  //   group: "Float Management",
  // },
  // {
  //   title: "Float Reconciliations",
  //   href: "/dashboard/float-management/reconciliations",
  //   icon: ClipboardList,
  //   roles: [
  //     UserRoleType.ADMIN,
  //     UserRoleType.BRANCHMANAGER,
  //     UserRoleType.TELLER,
  //     UserRoleType.AGENT,
  //   ],
  //   group: "Float Management",
  // },

  // Transactions & Statements
  {
    title: "All Transactions",
    href: "/dashboard/transactions",
    icon: ScrollText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      // UserRoleType.MEMBER,
    ],
    group: "Transactions",
  },
  {
    title: "Income & Expenditures",
    href: "/dashboard/transactions/income-expenditures",
    icon: ReceiptText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      // UserRoleType.AGENT,
      // UserRoleType.MEMBER,
    ],
    group: "Transactions",
  },

  {
    title: "Statements",
    href: "/dashboard/statements",
    icon: FileText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      // UserRoleType.MEMBER,
    ],
    group: "Transactions",
  },

  // Mobile Money Integration
  {
    title: "MM Deposits",
    href: "/dashboard/mobile-money/deposits",
    icon: Smartphone,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.MEMBER,
    ],
    group: "Mobile Money",
  },
  {
    title: "MM Withdrawals",
    href: "/dashboard/mobile-money/withdrawals",
    icon: Banknote,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.MEMBER,
    ],
    group: "Mobile Money",
  },
  {
    title: "MM Loan Repayments",
    href: "/dashboard/mobile-money/loan-repayments",
    icon: HandCoins,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      // UserRoleType.TELLER,
      // UserRoleType.AGENT,
      UserRoleType.MEMBER,
    ],
    group: "Mobile Money",
  },

  // Reports & Analytics
  // {
  //   title: "Manager Reports",
  //   href: "/dashboard/reports/manager",
  //   icon: LineChart,
  //   roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
  //   group: "Reports & Analytics",
  // },
  {
    title: "Financial Reports",
    href: "/dashboard/reports/",
    icon: LineChart,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Reports & Analytics",
  },
  {
    title: "Transaction Reports",
    href: "/dashboard/reports/transactions",
    icon: ScrollText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
      UserRoleType.AUDITOR,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
    ],
    group: "Reports & Analytics",
  },
  {
    title: "General Transaction Register",
    href: "/dashboard/reports/transactions/general-transaction-register-by-transaction-date",
    icon: FileText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
      UserRoleType.AUDITOR,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
    ],
    group: "Reports & Analytics",
    isNew: true,
  },
  {
    title: "Transaction Journal Listing",
    href: "/dashboard/reports/transactions/transaction-journal-listing-by-session-date",
    icon: FileText,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
      UserRoleType.AUDITOR,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
    ],
    group: "Reports & Analytics",
    isNew: true,
  },
  {
    title: "Saving and Shares Reports",
    href: "/dashboard/reports/savings-shares-reports",
    icon: PieChart,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.ACCOUNTANT,
    ],
    group: "Reports & Analytics",
  },
  // {
  //   title: "Loan Reports",
  //   href: "/dashboard/reports/loans",
  //   icon: LineChart,
  //   roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
  //   group: "Reports & Analytics",
  // },
  {
    title: "Activity Reports",
    href: "/dashboard/reports/activity",
    icon: Activity,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Reports & Analytics",
  },
  {
    title: "Other Financial Reports",
    href: "/dashboard/reports/financial-statements",
    icon: FileText,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Reports & Analytics",
  },

  {
    title: "Loan Officer Performance",
    href: "/dashboard/analytics/loan-officers",
    icon: TrendingUp,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Reports & Analytics",
    isNew: true,
  },
  {
    title: "Teller Performance",
    href: "/dashboard/analytics/tellers",
    icon: TrendingUp,
    roles: [UserRoleType.ADMIN, UserRoleType.BRANCHMANAGER],
    group: "Reports & Analytics",
    isNew: true,
  },

  // Notifications
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: BellRing,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      UserRoleType.MEMBER,
      UserRoleType.DATA_ENTRANT,
    ],
    group: "Communication",
  },
  {
    title: "Send Email",
    href: "/dashboard/notifications/email",
    icon: Mail,
    roles: [UserRoleType.ADMIN], // Only admin can send bulk/system emails
    group: "Communication",
  },
  {
    title: "Send SMS",
    href: "/dashboard/notifications/sms",
    icon: MessageSquareText,
    roles: [UserRoleType.ADMIN], // Only admin can send bulk/system SMS
    group: "Communication",
  },

  // Settings & Security
  {
    title: "System Settings",
    href: "/dashboard/settings/system",
    icon: Settings,
    roles: [UserRoleType.ADMIN],
    group: "Settings & Security",
  },
  {
    title: "Audit Log",
    href: "/dashboard/settings/audit-log",
    icon: ScrollText,
    roles: [UserRoleType.ADMIN],
    group: "Settings & Security",
  },
  {
    title: "Security Settings",
    href: "/dashboard/settings/security",
    icon: ShieldCheck,
    roles: [UserRoleType.ADMIN],
    group: "Settings & Security",
  },
  {
    title: "My Profile",
    href: "/dashboard/settings/profile",
    icon: UserCog,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      UserRoleType.MEMBER,
      UserRoleType.ACCOUNTANT,
      UserRoleType.AUDITOR,
      UserRoleType.LOANOFFICER,
      UserRoleType.DATA_ENTRANT,
    ],
    group: "Personal Settings",
  },
  {
    title: "Change Password",
    href: "/dashboard/change-password",
    icon: Fingerprint,
    roles: [
      UserRoleType.ADMIN,
      UserRoleType.BRANCHMANAGER,
      UserRoleType.TELLER,
      UserRoleType.AGENT,
      UserRoleType.MEMBER,
      UserRoleType.LOANOFFICER,
      UserRoleType.DATA_ENTRANT,
    ],
    group: "Personal Settings",
  },
];

export const routes: Route[] = ensureUniqueIcons(baseRoutes);

// Helper function to get routes for a specific role
export const getRoutesByRole = (role: UserRoleType) => {
  return routes.filter((route) => route.roles?.includes(role));
};

// Helper function to get routes by group for a specific role
export const getRoutesByGroup = (role: UserRoleType) => {
  const userRoutes = getRoutesByRole(role);
  const groups = new Map<string, Route[]>();

  userRoutes.forEach((route) => {
    const group = route.group || "Other";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)?.push(route);
  });

  return groups;
};

// Helper to check if a user has access to a specific route
export const hasRouteAccess = (route: Route, role: UserRoleType) => {
  return route.roles?.includes(role);
};
