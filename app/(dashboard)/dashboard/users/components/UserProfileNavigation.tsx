// app/dashboard/users/[id]/components/UserProfileNavigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  CreditCard,
  DollarSign,
  ArrowUpDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  PiggyBank,
  Activity,
  Shield,
} from "lucide-react";

interface UserProfileNavigationProps {
  userId: string;
}

export default function UserProfileNavigation({
  userId,
}: UserProfileNavigationProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      href: `/dashboard/users/${userId}`,
      label: "Overview",
      icon: User,
      description: "General information and summary",
    },
    {
      href: `/dashboard/users/${userId}/accounts`,
      label: "Accounts",
      icon: CreditCard,
      description: "Savings and account details",
    },
    {
      href: `/dashboard/users/${userId}/loans`,
      label: "Loans",
      icon: DollarSign,
      description: "Loan applications and active loans",
    },
    {
      href: `/dashboard/users/${userId}/transactions`,
      label: "Transactions",
      icon: ArrowUpDown,
      description: "All transaction history",
    },
    {
      href: `/dashboard/users/${userId}/deposits`,
      label: "Deposits",
      icon: ArrowDownToLine,
      description: "Deposit history and records",
    },
    {
      href: `/dashboard/users/${userId}/withdrawals`,
      label: "Withdrawals",
      icon: ArrowUpFromLine,
      description: "Withdrawal history and records",
    },
    {
      href: `/dashboard/users/${userId}/repayments`,
      label: "Repayments",
      icon: PiggyBank,
      description: "Loan repayment history",
    },
    {
      href: `/dashboard/users/${userId}/statements`,
      label: "Statements",
      icon: FileText,
      description: "Account statements and reports",
    },
    {
      href: `/dashboard/users/${userId}/activity`,
      label: "Activity",
      icon: Activity,
      description: "Recent activity and audit logs",
    },
    {
      href: `/dashboard/users/${userId}/security`,
      label: "Security",
      icon: Shield,
      description: "Security settings and logs",
    },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="flex overflow-x-auto">
        <div className="flex space-x-0 min-w-max">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center space-x-2 px-4 py-4 text-sm font-medium transition-all duration-200",
                  "border-b-2 border-transparent hover:border-blue-300 hover:text-blue-600",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset",
                  isActive
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-200",
                    isActive
                      ? "text-blue-600"
                      : "text-gray-400 group-hover:text-gray-600"
                  )}
                />
                <span className="whitespace-nowrap">{item.label}</span>

                {/* Tooltip */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 whitespace-nowrap">
                  {item.description}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
