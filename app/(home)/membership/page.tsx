import MembershipForm from "@/components/frontend/currentUiComponents/components/membership-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

import Image from "next/image"; // Importing Image from next/image

export default function MembershipPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
            alt="BUTSACCO membership"
            className="w-full h-full object-cover brightness-[0.4]"
            layout="fill" // Fill the section
            objectFit="cover" // Ensure it covers the section properly
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Join BUTSACCO</h1>
          <p className="text-xl max-w-3xl">
            Become a member of our growing community and access a range of
            financial services designed for your success.
          </p>
        </div>
      </section>

      {/* Membership Benefits */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Membership Benefits</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              As a member of BUTSACCO, you&apos;ll enjoy a range of exclusive
              benefits designed to support your financial journey.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">
                  Financial Services
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Access to affordable loans</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Competitive interest rates on savings</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Specialized loan products</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Flexible repayment terms</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Quick loan processing</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">
                  Education & Support
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Financial literacy workshops</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Business management training</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Investment advisory services</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Personalized financial counseling</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Regular member seminars</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">
                  Community Benefits
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Networking opportunities</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Participation in governance</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Annual general meetings</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Community development projects</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-primary mr-2 shrink-0" />
                    <span>Dividend payments on shares</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Membership Requirements */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Membership Requirements
              </h2>
              <p className="mb-6">
                Joining BUTSACCO is simple and straightforward. To become a
                member, you need to:
              </p>
              <ul className="space-y-4 mb-6">
                <li className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-1 mr-3 mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Be at least 18 years of age</p>
                    <p className="text-slate-600">
                      You must be an adult to join our cooperative.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-1 mr-3 mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Complete the membership application form
                    </p>
                    <p className="text-slate-600">
                      Fill out our application form with your personal details.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-1 mr-3 mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Pay the membership fee</p>
                    <p className="text-slate-600">
                      A one-time fee to join our cooperative.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-1 mr-3 mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Purchase the minimum required shares
                    </p>
                    <p className="text-slate-600">
                      Invest in our cooperative by purchasing shares.
                    </p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="bg-primary/10 rounded-full p-1 mr-3 mt-1">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Provide identification documents
                    </p>
                    <p className="text-slate-600">
                      National ID, passport, or other valid identification.
                    </p>
                  </div>
                </li>
              </ul>
              <p>
                Once your application is approved, you&apos;ll receive your
                membership certificate and can start enjoying the benefits of
                being a BUTSACCO member.
              </p>
            </div>
            <div>
              <Image
                src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
                alt="Membership Process"
                className="rounded-lg shadow-lg"
                width={500}
                height={350}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Membership Form */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-6">
              Ready to Join? Complete Your Application
            </h2>
            <p className="mb-6">
              Fill out the form below to apply for your membership with
              BUTSACCO.
            </p>
          </div>
          <MembershipForm />
        </div>
      </section>
    </div>
  );
}
