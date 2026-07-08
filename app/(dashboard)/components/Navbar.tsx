"use client";
import React from "react";
import Link from "next/link";
import {
  DollarSign,
  Home,
  Menu,
  User,
  Users,
  MapPin,
  Building2,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Session } from "next-auth";

import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { getRoutesByRole, UserRoleType } from "@/config/protected-routes";
import Logo from "@/components/global/Logo";
import { UserDropdownMenu } from "@/components/UserDropdownMenu";
import { NotificationDropdown } from "./notification-dropdown";
import { GlobalSearch } from "./global-search";

interface ExtendedSession extends Session {
  user: Session["user"] & {
    role: string;
    branchId?: string | null;
    branchName?: string | null;
    branchLocation?: string | null;
  };
}

export default function Navbar({ session }: { session: ExtendedSession }) {
  const router = useRouter();
  const user = session.user;

  async function handleLogout() {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch (error) {
      console.log(error);
    }
  }

  const role = session.user.role as UserRoleType;
  const pathname = usePathname();
  const routes = getRoutesByRole(role);

  // Get role display name and color
  const getRoleInfo = (userRole: string) => {
    switch (userRole) {
      case "ADMIN":
        return {
          label: "Administrator",
          color: "bg-purple-100 text-purple-800 border-purple-200",
        };
      case "BRANCHMANAGER":
        return {
          label: "Branch Manager",
          color: "bg-blue-100 text-blue-800 border-blue-200",
        };
      case "TELLER":
        return {
          label: "Teller",
          color: "bg-green-100 text-green-800 border-green-200",
        };
      case "AGENT":
        return {
          label: "Agent",
          color: "bg-orange-100 text-orange-800 border-orange-200",
        };
      case "MEMBER":
        return {
          label: "Member",
          color: "bg-gray-100 text-gray-800 border-gray-200",
        };
      case "LOANOFFICER":
        return {
          label: "Loan Officer",
          color: "bg-amber-100 text-amber-800 border-amber-200",
        };
      default:
        return {
          label: "User",
          color: "bg-gray-100 text-gray-800 border-gray-200",
        };
    }
  };

  const roleInfo = getRoleInfo(user.role);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-white/95 backdrop-blur-sm shadow-sm lg:h-[60px] lg:px-6 px-4">
      {/* Mobile Menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Logo href="/dashboard" />

            {routes.map((item, i) => {
              const Icon = item.icon;
              const isActive = item.href === pathname;
              return (
                <Link
                  key={i}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    isActive && "bg-muted text-primary",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.title}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Branch Info */}
          {user.branchName && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-2 mb-1">
                <Building2 className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Branch
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {user.branchName}
              </p>
              <p className="text-xs text-gray-500 flex items-center">
                <MapPin className="h-3 w-3 mr-1" />
                {user.branchLocation}
              </p>
            </div>
          )}

          <div className="mt-auto">
            <Button onClick={handleLogout} size="sm" className="w-full">
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Center - Branch Information (Desktop) */}
      <div className="hidden md:flex items-center justify-center flex-1">
        {user.branchName ? (
          <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50/50 rounded-lg border border-gray-200">
            <Building2 className="h-4 w-4 text-blue-600" />
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-900">
                {user.branchName}
              </p>
              <p className="text-xs text-gray-500 flex items-center justify-center">
                <MapPin className="h-3 w-3 mr-1" />
                {user.branchLocation}
              </p>
            </div>
          </div>
        ) : (
          // For users without branch assignment
          <div className="flex items-center space-x-2 px-4 py-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-600">
                No Branch Assigned
              </p>
              <p className="text-xs text-gray-400">System Administrator</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Side - User Info */}
      <div className="flex items-center space-x-2 md:space-x-3">
        <GlobalSearch routes={routes} />
        
        {/* Role Badge */}
        <Badge
          className={`${roleInfo.color} font-medium hidden sm:inline-flex`}
        >
          {roleInfo.label}
        </Badge>

        {/* User Dropdown */}
        <UserDropdownMenu
          username={user.name || "User"}
          email={user.email || ""}
          avatarUrl={user.image || undefined}
        />
        <NotificationDropdown />
      </div>
    </header>
  );
}
