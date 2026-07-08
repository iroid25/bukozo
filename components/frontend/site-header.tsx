"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Session } from "next-auth";
import { Menu, Sparkles, X, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import BukotoSaccoLogo from "../global/Logo";

export default function SiteHeader({ session: initialSession }: { session: any }) {
  const { data: nextSession, status } = useSession();
  const session = status === "loading" ? initialSession : nextSession;
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  // Close menu when clicking outside
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close menu on route change (for mobile)
  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 lg:px-6" ref={menuRef}>
        <div className="flex items-center justify-between h-20">
          {/* Bukoto Teachers SACCO Logo */}
          <div className="flex items-center">
            <BukotoSaccoLogo href="/" variant="light" />
          </div>

          {/* Desktop Navigation - Centered */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link
              href="/about"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium relative group"
            >
              About
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link
              href="/services"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium relative group"
            >
              Services
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link
              href="/membership"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium relative group"
            >
              Membership
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link
              href="/contact"
              className="text-gray-600 hover:text-blue-600 transition-colors font-medium relative group"
            >
              Contact
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </Link>
          </nav>

          {/* CTA Buttons - Right */}
          <div className="hidden lg:flex items-center space-x-3">
            {session ? (
              <div className="flex items-center space-x-3">
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold px-6 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </div>
            ) : (
                <Button
                  asChild
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold px-8 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <Link href="/login" className="flex items-center">
                    <Sparkles className="size-4 mr-2" />
                    Login
                  </Link>
                </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100 relative z-[60]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle mobile menu"
            type="button"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`lg:hidden absolute left-0 right-0 top-full bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-lg transition-all duration-300 ease-in-out ${
            isMenuOpen
              ? "opacity-100 visible translate-y-0"
              : "opacity-0 invisible -translate-y-2"
          }`}
          style={{ marginTop: "0px" }}
        >
          <div className="container mx-auto px-4 py-6">
            <nav className="flex flex-col space-y-4">
              <Link
                href="/about"
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                onClick={handleLinkClick}
              >
                About
              </Link>
              <Link
                href="/services"
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                onClick={handleLinkClick}
              >
                Services
              </Link>
              <Link
                href="/membership"
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                onClick={handleLinkClick}
              >
                Membership
              </Link>
              <Link
                href="/contact"
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                onClick={handleLinkClick}
              >
                Contact
              </Link>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                {session ? (
                  <Button
                    href="/dashboard"
                    className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold rounded-lg shadow-sm w-full"
                    icon={Shield}
                    onClick={handleLinkClick}
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button
                      href="/register"
                      variant="outline"
                      className="border-blue-200 text-blue-600 hover:bg-blue-50 w-full"
                      onClick={handleLinkClick}
                    >
                      Apply for Membership
                    </Button>
                    <Button
                      href="/login"
                      className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-semibold rounded-lg shadow-sm w-full"
                      icon={Shield}
                      onClick={handleLinkClick}
                    >
                      Member Login
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
