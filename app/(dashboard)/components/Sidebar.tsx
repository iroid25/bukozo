"use client";
import React, { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
// import { UserRole } from "@prisma/client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  LogOut,
  Bell,
  Menu,
  X,
  User,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
// import Logo from "../global/Logo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getRoutesByGroup } from "@/config/protected-routes";
import BukotoSaccoLogo from "@/components/global/Logo";

interface SidebarProps {
  role: any;
  user?: {
    name?: string;
    image?: string;
    email?: string;
  };
}

export default function Sidebar({ role, user }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [assetRequestCount, setAssetRequestCount] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();
  const routeGroups = getRoutesByGroup(role);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const response = await fetch("/api/v1/asset-requests/pending-count", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        setAssetRequestCount(Number(payload?.total || 0));
      } catch {
        setAssetRequestCount(0);
      }
    };

    void loadCounts();
  }, [role]);

  async function handleLogout() {
    try {
      await signOut();
      router.push("/auth");
    } catch (error) {
      console.log(error);
    }
  }

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const stripQuery = (href: string) => href.split("?")[0];
  const isRouteActive = (href: string) => pathname === stripQuery(href);

  // Get the user's initials for the avatar fallback
  const getInitials = () => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Animation variants
  const sidebarVariants = {
    expanded: { width: ["80px", "280px"] },
    collapsed: { width: ["280px", "80px"] },
  };

  const mobileMenuVariants = {
    open: {
      x: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
    closed: {
      x: "-100%",
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
      },
    },
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo & Header */}
      <div className="flex h-16 items-center border-b border-border/50 px-4">
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center w-full" : ""
          )}
        >
          <BukotoSaccoLogo href="/dashboard" isCollapsed={isCollapsed} />
        </div>

        <button
          onClick={toggleSidebar}
          className="hidden md:flex ml-auto h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isCollapsed ? "rotate-180" : ""
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4 z-[999]">
        <nav className="grid items-start px-2 lg:px-4">
          {Array.from(routeGroups.entries()).map(([group, routes]) => (
            <div
              key={group}
              className={cn(
                "mb-4 space-y-1",
                isCollapsed && "flex flex-col items-center"
              )}
            >
              {group !== "Other" && !isCollapsed && (
                <h4 className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {group}
                </h4>
              )}

              {routes.map((route, i) => {
                const Icon = route.icon;
                const isActive = isRouteActive(route.href);

                return (
                  <TooltipProvider key={i} delayDuration={300}>
                    <div className="space-y-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={route.href}
                            className={cn(
                              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                              isActive
                                ? "bg-primary/10 text-primary shadow-sm"
                                : "text-muted-foreground hover:bg-muted/80 hover:text-primary",
                              isCollapsed && "justify-center px-0",
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center justify-center rounded-md",
                                isActive,
                              )}
                            >
                              {Icon && <Icon className="h-5 w-5" />}
                            </div>

                            <AnimatePresence>
                              {!isCollapsed && (
                                <motion.span
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="text-sm font-medium"
                                >
                                  {route.title}
                                </motion.span>
                              )}
                            </AnimatePresence>

                            {!isCollapsed && route.isNew && (
                              <Badge
                                variant="default"
                                className="ml-auto text-[10px] px-1.5 py-0.5 bg-[#1e40af]/20 text-primary"
                              >
                                New
                              </Badge>
                            )}
                            {!isCollapsed &&
                              route.href === "/dashboard/accounts/assets/requests" &&
                              assetRequestCount > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="ml-auto text-[10px] px-1.5 py-0.5"
                                >
                                  {assetRequestCount}
                                </Badge>
                              )}
                          </Link>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right">
                            <p>{route.title}</p>
                            {route.isNew && (
                              <Badge
                                variant="default"
                                className="ml-1 text-[10px] px-1 py-0.5"
                              >
                                New
                              </Badge>
                            )}
                          </TooltipContent>
                        )}
                      </Tooltip>

                      {!isCollapsed && route.subLinks && route.subLinks.length > 0 && (
                        <div className="ml-6 space-y-1 border-l border-border/60 pl-4">
                          {route.subLinks.map((sub) => {
                            const isSubActive = isRouteActive(sub.href);
                            const SubIcon = sub.icon;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                                  isSubActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {SubIcon && <SubIcon className="h-4 w-4 shrink-0" />}
                                <span>{sub.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </TooltipProvider>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-t border-border/50 p-4">
        <Button
          onClick={handleLogout}
          size="sm"
          variant="outline"
          className={cn(
            "w-full flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors",
            isCollapsed && "justify-center px-0 aspect-square"
          )}
        >
          <LogOut className="h-4 w-4" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );

  // Mobile menu button that appears in the header on small screens
  const MobileMenuButton = () => (
    <button
      onClick={toggleMobileSidebar}
      className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg border"
    >
      <Menu className="h-4 w-4" />
      <span className="sr-only">Toggle Menu</span>
    </button>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:block h-screen border-r border-border/50 bg-background fixed top-0 left-0 z-30"
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {renderSidebarContent()}
      </motion.aside>

      {/* Mobile Menu Button - shown in header */}
      <div className="md:hidden fixed top-4 left-4 z-30">
        <MobileMenuButton />
      </div>

      {/* Mobile Sidebar - slides in from left */}
      <AnimatePresence>
        {isMobileOpen && (
          [
            <motion.div
              key="mobile-backdrop"
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleMobileSidebar}
            />,
            <motion.aside
              key="mobile-sidebar"
              className="fixed top-0 left-0 h-screen w-[280px] bg-background z-50 md:hidden"
              initial="closed"
              animate="open"
              exit="closed"
              variants={mobileMenuVariants}
            >
              <div className="flex justify-end p-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMobileSidebar}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {renderSidebarContent()}
            </motion.aside>
          ]
        )}
      </AnimatePresence>

      {/* Content padding when sidebar is expanded */}
      <div
        className={cn(
          "hidden md:block",
          isCollapsed ? "md:pl-[80px]" : "md:pl-[280px]"
        )}
      />
    </>
  );
}
