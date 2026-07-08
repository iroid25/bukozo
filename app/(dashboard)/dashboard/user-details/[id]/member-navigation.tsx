"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "", label: "Overview", icon: "👤" },
  { href: "/accounts", label: "Accounts", icon: "🏦" },
  { href: "/loans", label: "Loans", icon: "💰" },
  { href: "/transactions", label: "Transactions", icon: "💳" },
  { href: "/deposits", label: "Deposits", icon: "📈" },
  { href: "/withdrawals", label: "Withdrawals", icon: "📉" },
  { href: "/statements", label: "Statements", icon: "📄" },
];

interface MemberNavigationProps {
  memberId: string;
}

export function MemberNavigation({ memberId }: MemberNavigationProps) {
  const pathname = usePathname();

  return (
    <div className="border-b">
      <nav className="flex space-x-8 overflow-x-auto">
        {navigationItems.map((item) => {
          const href = `/dashboard/user-details/${memberId}${item.href}`;
          const isActive = pathname === href;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
