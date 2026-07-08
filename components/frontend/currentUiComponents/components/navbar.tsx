"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn, UserPlus } from "lucide-react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-[#1e40af] text-white sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="font-bold text-2xl text-white">
            BUTSACCO
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/"
              className="text-white hover:text-white/80 font-medium"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="text-white hover:text-white/80 font-medium"
            >
              About Us
            </Link>
            <Link
              href="/services"
              className="text-white hover:text-white/80 font-medium"
            >
              Services
            </Link>
            <Link
              href="/membership"
              className="text-white hover:text-white/80 font-medium"
            >
              Membership
            </Link>
            <Link
              href="/contact"
              className="text-white hover:text-white/80 font-medium"
            >
              Contact
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-white hover:text-white text-blue-600 hover:bg-white/10 hover:text-white"
            >
              <Link href="/login" className="flex items-center">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
            <Button
              asChild
              className="bg-white text-[#1e40af] hover:bg-white/90"
            >
              <Link href="/register" className="flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                Register
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-md text-white hover:bg-blue-800"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-[#1e40af] border-t border-blue-800">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link
              href="/"
              className="block py-2 text-white hover:text-white/80 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/about"
              className="block py-2 text-white hover:text-white/80 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              About Us
            </Link>
            <Link
              href="/services"
              className="block py-2 text-white hover:text-white/80 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="/membership"
              className="block py-2 text-white hover:text-white/80 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Membership
            </Link>
            <Link
              href="/contact"
              className="block py-2 text-white hover:text-white/80 font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="pt-2 border-t border-blue-800 flex flex-col space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start border-white text-white hover:bg-white/10 hover:text-white"
              >
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </Link>
              </Button>
              <Button
                asChild
                className="w-full justify-start bg-white text-[#1e40af] hover:bg-white/90"
              >
                <Link
                  href="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Register
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
