import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BriefcaseIcon,
  GraduationCap,
  Home,
  ShoppingBag,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoanProductsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1593672755342-741a7f868732?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
            alt="BUTSACCO loans"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Loan Products</h1>
          <p className="text-xl max-w-3xl">
            Explore our range of affordable loan products designed to meet your
            financial needs.
          </p>
        </div>
      </section>

      {/* Loan Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Our Credit/Loan Products
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              We offer a variety of loan products with competitive interest
              rates and flexible repayment terms.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Business Loan */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <BriefcaseIcon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Business Loan</CardTitle>
                <CardDescription>
                  Expand your business with our affordable business loan
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Interest rate: 2.5% reducing rate per month</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Grace period: 3 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Maximum loan period: 12 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Application fee: UGX 5,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Processing fee: 1% of loan amount</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Insurance: 1.5% of principal amount</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/loans/apply">
                    Apply Now{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* School Fees Loan */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>School Fees Loan</CardTitle>
                <CardDescription>
                  Ensure your child&apos;s education continues without
                  interruption
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Interest rate: 1.8% flat rate</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>No grace period</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Maximum loan period: 6 months (semester period)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Application fee: UGX 5,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Processing fee: 1% of loan amount</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Insurance: 1.5% of principal amount</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/loans/apply">
                    Apply Now{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Asset Acquisition Loan */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <ShoppingBag className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Asset Acquisition Loan</CardTitle>
                <CardDescription>
                  Purchase assets to improve your quality of life or business
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Interest rate: 2.5% reducing balance rate</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Grace period: 3 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Maximum loan period: 18 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Application fee: UGX 5,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Processing fee: 1% of loan amount</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Insurance: 1.5% of principal amount</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/loans/apply">
                    Apply Now{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Home Improvement Loan */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Home Improvement Loan</CardTitle>
                <CardDescription>
                  Renovate or improve your home with our affordable loan
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Interest rate: 2.5% reducing balance rate</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Grace period: 3 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Maximum loan period: 12 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Application fee: UGX 5,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Processing fee: 1% of loan amount</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Insurance: 1.5% of principal amount</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/loans/apply">
                    Apply Now{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
