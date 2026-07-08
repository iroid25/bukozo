import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Badge,
  Calculator,
  CheckCircle,
  CreditCard,
  DollarSign,
  FileText,
  PiggyBank,
  Smartphone,
} from "lucide-react";

export default function Services() {
  return (
    <section id="services" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-emerald-50/50 to-white"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(16,185,129,0.2) 1px, transparent 0)`,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <Badge className="bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 mb-6 px-4 py-2 font-semibold">
            Our Services
          </Badge>
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Comprehensive
              {/* <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div> */}
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Financial Solutions
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            From savings to loans, we offer a complete range of financial
            services tailored for educators
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: PiggyBank,
              title: "Savings Accounts",
              description:
                "Secure your future with our competitive savings plans",
              features: [
                "Competitive interest rates",
                "No minimum balance",
                "Digital access 24/7",
              ],
            },
            {
              icon: CreditCard,
              title: "Personal Loans",
              description: "Quick and affordable loans for your personal needs",
              features: [
                "Up to 3x your savings",
                "Flexible repayment",
                "Quick approval",
              ],
            },
            {
              icon: Smartphone,
              title: "Digital Banking",
              description: "Modern digital solutions for convenient banking",
              features: [
                "Mobile app access",
                "Online transactions",
                "Real-time notifications",
              ],
            },
            {
              icon: DollarSign,
              title: "Investment Plans",
              description: "Grow your wealth with our investment opportunities",
              features: [
                "Fixed deposits",
                "Share capital growth",
                "Annual dividends",
              ],
            },
            {
              icon: Calculator,
              title: "Financial Advisory",
              description: "Expert guidance for your financial decisions",
              features: [
                "Personal consultations",
                "Financial planning",
                "Investment advice",
              ],
            },
            {
              icon: FileText,
              title: "Insurance Services",
              description:
                "Protect yourself and your family with our insurance",
              features: [
                "Life insurance",
                "Health coverage",
                "Asset protection",
              ],
            },
          ].map((service, index) => (
            <Card
              key={index}
              className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/50 group"
            >
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <service.icon className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="font-bricolage text-2xl font-black text-gray-900 leading-[1.2]">
                  {service.title}
                </CardTitle>
                <CardDescription className="text-gray-600 text-base">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-gray-600">
                  {service.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                      <span className="font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
