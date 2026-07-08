import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart2,
  BookOpen,
  Building,
  CreditCard,
  Home,
  Leaf,
  Tractor,
} from "lucide-react";

export default function ServicesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
            alt="BUTSACCO services"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Our Services</h1>
          <p className="text-xl max-w-3xl">
            Discover the range of financial services we offer to help you
            achieve your goals.
          </p>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Financial Services for Every Need
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              At BUTSACCO, we offer a comprehensive range of financial services
              designed to meet the diverse needs of our members.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Savings Products */}
            <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-4 rounded-full w-fit mb-6">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Savings Products</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Regular Savings Accounts</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Fixed Deposit Accounts</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Children&apos;s Savings Accounts</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Retirement Savings Plans</span>
                </li>
              </ul>
              <p className="text-slate-600 mb-6">
                Our savings products are designed to help you build financial
                security with competitive interest rates and flexible terms.
              </p>
              <Button asChild variant="outline">
                <Link href="/services/savings">Learn More</Link>
              </Button>
            </div>

            {/* Loan Products */}
            <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-4 rounded-full w-fit mb-6">
                <BarChart2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Loan Products</h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Personal Loans</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Business Loans</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Education Loans</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Emergency Loans</span>
                </li>
              </ul>
              <p className="text-slate-600 mb-6">
                Our loan products feature competitive interest rates, flexible
                repayment terms, and quick processing times.
              </p>
              <Button asChild variant="outline">
                <Link href="/services/loans">Learn More</Link>
              </Button>
            </div>

            {/* Financial Education */}
            <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-4 rounded-full w-fit mb-6">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">
                Financial Education
              </h3>
              <ul className="space-y-3 mb-6">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Financial Literacy Workshops</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Business Management Training</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Investment Advisory</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Retirement Planning</span>
                </li>
              </ul>
              <p className="text-slate-600 mb-6">
                We believe in empowering our members with the knowledge and
                skills to make informed financial decisions.
              </p>
              <Button asChild variant="outline">
                <Link href="/services/education">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Specialized Loans */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Specialized Loan Products
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              We offer specialized loan products designed to meet specific needs
              of our members.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Housing Loans</h3>
              <p className="text-slate-600">
                Affordable financing options for home construction, purchase, or
                renovation.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Tractor className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Agricultural Loans</h3>
              <p className="text-slate-600">
                Support for farmers to purchase equipment, seeds, and other
                agricultural inputs.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Business Expansion</h3>
              <p className="text-slate-600">
                Financing for business growth, equipment purchase, and working
                capital.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Leaf className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Green Energy Loans</h3>
              <p className="text-slate-600">
                Financing for solar panels, energy-efficient appliances, and
                sustainable solutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1573164574572-cb89e39749b4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1400&q=80"
                alt="Why choose us"
                className="w-full h-full object-cover rounded-lg shadow-lg"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Why Choose BUTSACCO?</h2>
              <p className="text-xl text-slate-600 mb-6">
                Our mission is to provide accessible, reliable, and
                member-focused financial services to improve the lives of our
                members.
              </p>
              <ul className="list-disc pl-6 text-slate-600">
                <li>Competitive Interest Rates</li>
                <li>Flexible Loan Terms</li>
                <li>Personalized Service</li>
                <li>Comprehensive Financial Education</li>
                <li>Community-Centered Approach</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
