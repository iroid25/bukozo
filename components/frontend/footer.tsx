"use client";
import Image from "next/image";
import Link from "next/link";
import ThemeButton from "./theme-button";
import { useRouter } from "next/navigation";
import { getContactInfo } from "@/config/meta";
import Logo from "../global/Logo";
import {
  Facebook,
  Instagram,
  Linkedin,
  PiggyBank,
  Twitter,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-20">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <PiggyBank className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold">BUTSACCO</span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Empowering teachers and communities through accessible financial
              services since 2009.
            </p>
            <div className="flex space-x-4">
              <Facebook className="w-6 h-6 text-gray-400 hover:text-emerald-400 cursor-pointer transition-colors" />
              <Twitter className="w-6 h-6 text-gray-400 hover:text-emerald-400 cursor-pointer transition-colors" />
              <Instagram className="w-6 h-6 text-gray-400 hover:text-emerald-400 cursor-pointer transition-colors" />
              <Linkedin className="w-6 h-6 text-gray-400 hover:text-emerald-400 cursor-pointer transition-colors" />
            </div>
          </div>

          <div>
            <h4 className="font-bricolage text-xl font-black mb-6 leading-[1.2]">
              Services
            </h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Savings Accounts
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Personal Loans
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Digital Banking
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Investment Plans
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Insurance
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bricolage text-xl font-black mb-6 leading-[1.2]">
              Company
            </h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Leadership
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  News
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bricolage text-xl font-black mb-6 leading-[1.2]">
              Support
            </h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Security
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Complaints
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-16 pt-8 text-center text-gray-400">
          <p>
            &copy; {new Date().getFullYear()} BUTSACCO. All rights reserved.
            Licensed by the Ministry of Trade and Cooperatives, Uganda.
          </p>
        </div>
      </div>
    </footer>
  );
}
