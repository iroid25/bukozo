"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Wallet,
  Plus,
  Send,
  FileText,
  Calendar,
  Receipt,
  User,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Define sidebar items for different user roles
const clientMenuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Deposits", href: "/dashboard/member-details/deposit-details", icon: Plus },
  { name: "Withdrawals", href: "/dashboard/member-details/my-withdrawals", icon: Send },
  { name: "Loan Applications", href: "/dashboard/loanprocess/tracking", icon: FileText },
  { name: "Loan Ledger", href: "/dashboard/loans/reports/ledger", icon: CreditCard },
  { name: "Loan Schedule", href: "/dashboard/loans/reports/repayment-schedule", icon: Calendar },
  { name: "Statements", href: "/dashboard/statements", icon: Receipt },
  { name: "Profile", href: "/dashboard/profile", icon: User },
  { name: "Change Password", href: "/dashboard/change-password", icon: Lock },
];

const staffMenuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/dashboard/clients", icon: Users },
  { name: "Savings", href: "/dashboard/savings", icon: Wallet },
  { name: "Loans", href: "/dashboard/loans", icon: CreditCard },
  { name: "Transactions", href: "/dashboard/transactions", icon: BarChart3 },
  { name: "Reports", href: "/dashboard/reports", icon: Landmark },
  { name: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardSidebar() {
  // For demo purposes, let's assume we can toggle between client and staff view
  const [userRole, setUserRole] = useState<"client" | "staff">("client");
  const pathname = usePathname();

  const menuItems = userRole === "client" ? clientMenuItems : staffMenuItems;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-slate-200 pt-5 pb-4">
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">
              {userRole === "client" ? "Client Portal" : "Staff Portal"}
            </h2>

            {/* Role toggle for demo purposes */}
            <button
              onClick={() =>
                setUserRole(userRole === "client" ? "staff" : "client")
              }
              className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
            >
              Switch to {userRole === "client" ? "Staff" : "Client"}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                  isActive
                    ? "bg-[#1e40af] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5",
                    isActive ? "text-white" : "text-slate-500"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 mt-6">
          <div className="bg-blue-50 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              Need Help?
            </h3>
            <p className="text-xs text-blue-700">
              Contact our support team for assistance with your account.
            </p>
            <Link
              href="/dashboard/support"
              className="mt-2 text-xs font-medium text-blue-800 hover:text-blue-900 flex items-center"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
