import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  DollarSign,
  GraduationCap,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SavingsProductsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1579621970795-87facc2f976d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
            alt="BUTSACCO savings"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Savings Products
          </h1>
          <p className="text-xl max-w-3xl">
            Secure your financial future with our diverse range of savings
            options.
          </p>
        </div>
      </section>

      {/* Savings Products */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Savings Products</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              We offer various savings options to help you achieve your
              financial goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Voluntary Savings */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Voluntary Savings</CardTitle>
                <CardDescription>
                  Flexible savings with easy access to your funds
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>
                      Deposit and withdraw at any time (at office or online)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>No interest earned on this account</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Minimum saving amount: UGX 5,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Monthly service fee: UGX 500</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>
                      Withdrawal charge depends on amount and method used
                    </span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/savings/open">
                    Open Account{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Compulsory Savings */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Compulsory Savings</CardTitle>
                <CardDescription>
                  Disciplined savings with annual withdrawal options
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Deposit at any time</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Withdrawals only allowed in December</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Earns interest depending on surplus of the year</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>No fees or charges</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Great for long-term savings goals</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/savings/open">
                    Open Account{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Fixed Savings */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Fixed Savings</CardTitle>
                <CardDescription>
                  Maximize your returns with our fixed deposit account
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Minimum deposit: UGX 500,000</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>No charges or fees</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Earns interest at a rate of 10% per annum</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Fixed period options: 3, 6, 9, or 12 months</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Ideal for medium to long-term savings goals</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/savings/open">
                    Open Account{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Junior Savings */}
            <Card className="border-0 shadow-lg h-full flex flex-col">
              <CardHeader>
                <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Junior Savings</CardTitle>
                <CardDescription>
                  Secure your child&apos;s future with our junior savings
                  account
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>For minors under 18 years of age</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Operated by parent or guardian</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Earns interest</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>No monthly charges</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-primary font-bold mr-2">•</span>
                    <span>Withdrawals limited to twice per school term</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full group">
                  <Link href="/services/savings/open">
                    Open Account{" "}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits of Saving */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Benefits of Saving with BUTSACCO
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Discover the advantages of saving with us and how it can help
              secure your financial future.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Financial Security</h3>
              <p className="text-slate-600">
                Build a financial safety net to protect you and your family
                during emergencies and unexpected expenses.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Competitive Returns
              </h3>
              <p className="text-slate-600">
                Earn competitive interest rates on your savings, helping your
                money grow over time.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Access to Loans</h3>
              <p className="text-slate-600">
                Regular savings with BUTSACCO qualifies you for various loan
                products at favorable terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How to Open Account */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              How to Open a Savings Account
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Follow these simple steps to open a savings account with BUTSACCO.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Become a Member</h3>
              <p className="text-slate-600">
                Join BUTSACCO by completing the membership application process.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">
                Select Account Type
              </h3>
              <p className="text-slate-600">
                Choose the savings account that best meets your financial goals.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Complete Forms</h3>
              <p className="text-slate-600">
                Fill out the required forms and provide necessary documentation.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">4</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Deposit Funds</h3>
              <p className="text-slate-600">
                Make an initial deposit to activate your account and start
                saving.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
