"use client";

import { Button } from "@/components/ui/button";
import {
  User,
  CreditCard,
  DollarSign,
  Smartphone,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface DashboardSidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export default function DashboardSidebar({
  activeSection,
  setActiveSection,
}: DashboardSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: "profile", label: "Profile", icon: User },
    { id: "transactions", label: "Transactions", icon: CreditCard },
    { id: "loans", label: "Loans", icon: DollarSign },
    { id: "mobile-money", label: "Mobile Money", icon: Smartphone },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMenuItemClick = (sectionId: string) => {
    setActiveSection(sectionId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="md:hidden bg-white border-b p-3 sticky top-16 z-30">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dashboard</h2>
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Sidebar - Desktop always visible, Mobile conditionally visible */}
      <aside
        className={`bg-white border-r w-full md:w-64 shrink-0 ${
          isMobileMenuOpen ? "block" : "hidden"
        } md:block transition-all duration-300 ease-in-out`}
      >
        <div className="p-3 md:p-4">
          <div className="space-y-1">
            <Link href="/">
              <Button variant="ghost" className="w-full justify-start">
                <Home className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>

          <div className="mt-4 md:mt-6">
            <h3 className="text-sm font-medium text-slate-500 px-2 mb-2">
              Menu
            </h3>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeSection === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleMenuItemClick(item.id)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              ))}
            </nav>
          </div>

          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
