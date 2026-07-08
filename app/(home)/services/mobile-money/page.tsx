import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Phone,
  MapPin,
  Send,
  Download,
  CreditCard,
  CheckCircle,
  MessageSquare,
  ArrowRight,
  Smartphone,
  RefreshCw,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

export default function MobileMoneyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
            alt="Mobile Money Services"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-16 sm:py-24 text-white">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">
            Mobile Money Services
          </h1>
          <p className="text-lg sm:text-xl max-w-3xl">
            Convenient banking solutions at your fingertips through MTN Mobile
            Money and Airtel Money.
          </p>
        </div>
      </section>

      {/* Mobile Money Overview */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Banking Made Simple</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              BUTSACCO has partnered with leading mobile money providers to make
              your banking experience seamless and convenient.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 gap-y-12 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg h-full">
              <CardHeader className="text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-full flex items-center justify-center overflow-hidden">
                  <img
                    src="/images/mtn-mobile-money.png"
                    alt="MTN Mobile Money"
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardTitle className="text-xl sm:text-2xl">
                  MTN Mobile Money
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Fast and secure mobile banking with MTN
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm sm:text-base">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>
                      Receive loan disbursements directly to your MTN Mobile
                      Money account
                    </span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>Make loan repayments from anywhere, anytime</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>
                      Deposit money into your BUTSACCO savings account
                    </span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>
                      Receive instant transaction confirmations via SMS
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg h-full">
              <CardHeader className="text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 bg-red-500 rounded-full flex items-center justify-center overflow-hidden">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Airtel_logo.svg/512px-Airtel_logo.svg.png"
                    alt="Airtel Money"
                    className="w-14 h-14 object-contain"
                  />
                </div>
                <CardTitle className="text-xl sm:text-2xl">
                  Airtel Money
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Convenient mobile banking with Airtel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm sm:text-base">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>
                      Receive loan disbursements directly to your Airtel Money
                      account
                    </span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>Make loan repayments easily from your phone</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>Transfer funds to your BUTSACCO savings account</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0 mt-0.5" />
                    <span>Get real-time transaction notifications</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Benefits of Mobile Money
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Discover why mobile money services are the preferred choice for
              many of our members.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">
                Convenience
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Access financial services anytime, anywhere using your mobile
                phone.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">Speed</h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Instant transactions without the need to visit our physical
                branch.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">
                Cost-Effective
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Reduced transaction costs compared to traditional banking
                methods.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-base sm:text-lg mb-2">
                Security
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Secure transactions with PIN protection and transaction
                notifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Using mobile money with BUTSACCO is simple and straightforward.
              Follow these steps to get started.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="order-2 md:order-1">
              <img
                src="https://images.unsplash.com/photo-1611174743420-3d7df880ce32?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
                alt="Using Mobile Money"
                className="rounded-lg shadow-lg w-full h-auto"
              />
            </div>
            <div className="order-1 md:order-2">
              <div className="space-y-6 sm:space-y-8">
                <div className="flex gap-3 sm:gap-4">
                  <div className="bg-primary/10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <span className="font-bold text-primary text-sm sm:text-base">
                      1
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                      Register for Mobile Money
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base">
                      Ensure you have an active MTN Mobile Money or Airtel Money
                      account. Visit your nearest service center if you need to
                      register.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="bg-primary/10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <span className="font-bold text-primary text-sm sm:text-base">
                      2
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                      Link Your Account
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base">
                      Visit our office to link your mobile money number with
                      your BUTSACCO account. Bring your ID and account details.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="bg-primary/10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <span className="font-bold text-primary text-sm sm:text-base">
                      3
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                      Start Transacting
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base">
                      Once linked, you can start making deposits, receiving
                      loans, and making repayments through your mobile money
                      account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="bg-primary/10 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 mt-1">
                    <span className="font-bold text-primary text-sm sm:text-base">
                      4
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-1 sm:mb-2">
                      Track Your Transactions
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base">
                      Receive SMS confirmations for all transactions and check
                      your account balance anytime through our office or mobile
                      banking.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Available */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Services Available via Mobile Money
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Explore the range of financial services you can access through
              your mobile phone.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white p-5 sm:p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Send className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">
                Loan Disbursements
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Receive approved loans directly to your mobile money account
                within minutes.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Download className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">
                Savings Deposits
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Transfer money from your mobile wallet to your BUTSACCO savings
                account.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">
                Loan Repayments
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Make loan repayments easily from anywhere using your mobile
                money account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transaction Guide */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              How to Make Transactions
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Follow these simple steps to perform various transactions using
              mobile money.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">
                  MTN Mobile Money Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 text-base sm:text-lg">
                    To Deposit Money to BUTSACCO:
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-sm sm:text-base">
                    <li>Dial *165# on your phone</li>
                    <li>Select &quot;Financial Services&quot;</li>
                    <li>Select &quot;Banking&quot;</li>
                    <li>Select &quot;Deposit&quot;</li>
                    <li>Enter BUTSACCO&apos;s code: [Code]</li>
                    <li>Enter your account number</li>
                    <li>Enter amount</li>
                    <li>Confirm with your PIN</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-base sm:text-lg">
                    To Make Loan Repayments:
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-sm sm:text-base">
                    <li>Dial *165# on your phone</li>
                    <li>Select &quot;Financial Services&quot;</li>
                    <li>Select &quot;Banking&quot;</li>
                    <li>Select &quot;Loan Repayment&quot;</li>
                    <li>Enter BUTSACCO&apos;s code: [Code]</li>
                    <li>Enter your loan account number</li>
                    <li>Enter amount</li>
                    <li>Confirm with your PIN</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg h-full">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">
                  Airtel Money Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2 text-base sm:text-lg">
                    To Deposit Money to BUTSACCO:
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-sm sm:text-base">
                    <li>Dial *185# on your phone</li>
                    <li>Select &quot;Make Payments&quot;</li>
                    <li>Select &quot;Pay Bill&quot;</li>
                    <li>Select &quot;Financial Services&quot;</li>
                    <li>Enter BUTSACCO&apos;s code: [Code]</li>
                    <li>Enter your account number</li>
                    <li>Enter amount</li>
                    <li>Confirm with your PIN</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-base sm:text-lg">
                    To Make Loan Repayments:
                  </h3>
                  <ol className="list-decimal pl-5 space-y-2 text-slate-600 text-sm sm:text-base">
                    <li>Dial *185# on your phone</li>
                    <li>Select &quot;Make Payments&quot;</li>
                    <li>Select &quot;Pay Bill&quot;</li>
                    <li>Select &quot;Financial Services&quot;</li>
                    <li>Select &quot;Loan Repayment&quot;</li>
                    <li>Enter BUTSACCO&apos;s code: [Code]</li>
                    <li>Enter your loan account number</li>
                    <li>Enter amount</li>
                    <li>Confirm with your PIN</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-10">
            <p className="text-slate-600 mb-4">
              Need help with your mobile money transactions? Our team is ready
              to assist you.
            </p>
            <Button asChild>
              <Link href="/contact" className="group">
                Contact Our Support Team{" "}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Contact Us</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Need help with mobile money services? Reach out to us through any
              of these channels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="border-0 shadow-md h-full">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-primary/10 p-2 sm:p-3 rounded-full shrink-0">
                    <Phone className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-2">
                      Phone Contact
                    </h3>
                    <ul className="space-y-2 text-slate-600 text-sm sm:text-base">
                      <li>
                        Office lines: +256789 529810 and +256779 021565 (during
                        working hours)
                      </li>
                      <li>Manager: +256788 566925</li>
                      <li>Chairperson: +256782 147266</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md h-full">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-primary/10 p-2 sm:p-3 rounded-full shrink-0">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-2">
                      Digital Contact
                    </h3>
                    <ul className="space-y-2 text-slate-600 text-sm sm:text-base">
                      <li>WhatsApp: 0788 566925</li>
                      <li>Email: bukonzounitedteacherssacco@gmail.com</li>
                      <li>Twitter (X): BUTSACCO</li>
                      <li>LinkedIn: bukonzounitedteacherssacco@gmail.com</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md h-full">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-primary/10 p-2 sm:p-3 rounded-full shrink-0">
                    <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-2">
                      Physical Address
                    </h3>
                    <ul className="space-y-2 text-slate-600 text-sm sm:text-base">
                      <li>Plot 2 Main Street, Kisinga Bwera Road</li>
                      <li>
                        Located in Kisinga II cell, on Kisinga-Kinyamaseke road
                        about 100 metres from Kisinga town council headquarters
                      </li>
                      <li>P.O. Box 142 Kasese, Uganda</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Find answers to common questions about our mobile money services.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                Are there any charges for using mobile money services?
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Standard mobile money charges from your provider (MTN or Airtel)
                apply. BUTSACCO does not charge additional fees for mobile money
                transactions.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                How long does it take for a mobile money transaction to reflect
                in my BUTSACCO account?
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Most transactions are processed instantly. However, during peak
                times or due to network issues, it may take up to 24 hours. If
                your transaction hasn't reflected after 24 hours, please contact
                our office.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                Can I link multiple mobile money numbers to my BUTSACCO account?
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                Yes, you can link up to two mobile money numbers (one MTN and
                one Airtel) to your BUTSACCO account. Visit our office with your
                ID and account details to set this up.
              </p>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                What should I do if I change my mobile number?
              </h3>
              <p className="text-slate-600 text-sm sm:text-base">
                If you change your mobile number, please visit our office as
                soon as possible to update your records. This ensures the
                security of your account and uninterrupted access to mobile
                money services.
              </p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button asChild>
              <Link href="/contact">Contact Us for More Information</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16bg-[#1e40af] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Visit our office today to link your mobile money account with
            BUTSACCO and start enjoying the convenience of mobile banking.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
            >
              <Link href="/contact">Contact Us Today</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-white text-primary hover:bg-white/90"
            >
              <Link href="/membership">Become a Member</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
