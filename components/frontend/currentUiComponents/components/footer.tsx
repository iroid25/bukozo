import Link from "next/link";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  MessageSquare,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-xl font-bold mb-4">BUTSACCO</h3>
            <p className="text-slate-300 mb-4">
              Empowering communities through financial inclusion since 2009.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-white hover:text-primary">
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link href="#" className="text-white hover:text-primary">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter (X)</span>
              </Link>
              <Link href="#" className="text-white hover:text-primary">
                <Instagram className="h-5 w-5" />
                <span className="sr-only">Instagram</span>
              </Link>
              <Link href="#" className="text-white hover:text-primary">
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link
                href="https://wa.me/256788566925"
                className="text-white hover:text-primary"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="sr-only">WhatsApp</span>
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-slate-300 hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-300 hover:text-white">
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/services"
                  className="text-slate-300 hover:text-white"
                >
                  Services
                </Link>
              </li>
              <li>
                <Link
                  href="/membership"
                  className="text-slate-300 hover:text-white"
                >
                  Membership
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-slate-300 hover:text-white"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Our Services</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/services/savings"
                  className="text-slate-300 hover:text-white"
                >
                  Savings Products
                </Link>
              </li>
              <li>
                <Link
                  href="/services/loans"
                  className="text-slate-300 hover:text-white"
                >
                  Loan Products
                </Link>
              </li>
              <li>
                <Link
                  href="/services/mobile-money"
                  className="text-slate-300 hover:text-white"
                >
                  Mobile Money Services
                </Link>
              </li>
              <li>
                <Link
                  href="/services/education"
                  className="text-slate-300 hover:text-white"
                >
                  Financial Education
                </Link>
              </li>
              <li>
                <Link
                  href="/services/business"
                  className="text-slate-300 hover:text-white"
                >
                  Hardware Shop
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2">
              <li className="text-slate-300">
                Plot 2 Main Street, Kisinga Bwera Road, Kisinga, Uganda
              </li>
              <li className="text-slate-300">
                +256 789 529810 / +256 779 021565
              </li>
              <li className="text-slate-300">
                bukonzounitedteacherssacco@gmail.com
              </li>
              <li className="text-slate-300">P.O. Box 142 Kasese, Uganda</li>
              <li className="text-slate-300">WhatsApp: 0788 566925</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-slate-400">
          <p>
            &copy; {new Date().getFullYear()} BUTSACCO. All rights reserved.
          </p>
          <div className="mt-2 space-x-4">
            <Link
              href="/privacy-policy"
              className="text-slate-400 hover:text-white"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-slate-400 hover:text-white"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
