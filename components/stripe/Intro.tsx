import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CreditCard,
  ExternalLink,
  Zap,
  Shield,
  CreditCardIcon,
  CheckCircle,
} from "lucide-react";
// import StripeCheckoutModal from '@/components/stripe-checkout-modal';

const StripeIntroSection = () => {
  return (
    <div className="relative py-16 px-4 overflow-hidden">
      {/* Fading grid background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-300 via-purple-300 to-pink-300"></div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent 39px, rgba(0,0,0,0.05) 1px), linear-gradient(to bottom, transparent 39px, rgba(0,0,0,0.05) 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="container mx-auto relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Payment Solutions with Stripe
            </h1>
            <div className="h-1 w-24 mx-auto mb-6 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
            <p className="text-slate-700 text-lg max-w-2xl mx-auto">
              Integrate secure payment processing with our Stripe solutions.
              Choose between popup checkout or embedded payment forms.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Popup Checkout Card */}
            <Card className="flex flex-col h-full overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 rounded-full blur-xl"></div>
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg text-white">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  Stripe Checkout Popup
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Redirect customers to Stripe's hosted checkout page in a popup
                  modal
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-6">
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-white rounded-md flex items-center justify-center mb-6 border border-slate-200 shadow-sm">
                  <img
                    src="/stripe-checkout.png?height=200&width=320"
                    alt="Stripe Checkout Preview"
                    className="h-full w-full object-cover rounded-md"
                  />
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Pre-built, responsive UI that works across devices
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Support for 135+ currencies and multiple payment methods
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Built-in address collection and validation
                    </span>
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="pt-4 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0"
                >
                  <Link
                    href="/stripe-checkout"
                    className="flex items-center justify-center"
                  >
                    Try Stripe Checkout Modal
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Embedded Checkout Card */}
            <Card className="flex flex-col h-full overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl">
              <div className="absolute top-0 left-0 w-24 h-24 -ml-8 -mt-8 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 opacity-20 rounded-full blur-xl"></div>
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-2 rounded-lg text-white">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  Embedded Stripe Checkout
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Customize the payment experience directly within your
                  application
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow pt-6">
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-white rounded-md flex items-center justify-center mb-6 border border-slate-200 shadow-sm">
                  <img
                    src="/stripe-embed.png?height=200&width=320"
                    alt="Embedded Stripe Preview"
                    className="h-full w-full object-cover rounded-md"
                  />
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Full control over the payment form UI
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Seamless integration with your existing design system
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full p-1 mr-3 mt-0.5 flex-shrink-0">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                    <span className="text-slate-700">
                      Advanced customization options for payment flows
                    </span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="pt-4 bg-gradient-to-br from-slate-50 to-white border-t border-slate-100">
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0"
                >
                  <Link
                    href="/stripe-elements"
                    className="flex items-center justify-center"
                  >
                    Try Embedded Checkout
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap justify-center items-center gap-6 text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">PCI Compliant</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <span className="text-sm font-medium">Fast Integration</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5" />
              <span className="text-sm font-medium">
                Multiple Payment Methods
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeIntroSection;
