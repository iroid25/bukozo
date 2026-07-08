import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  CheckCircle,
  Users,
  Phone,
  Mail,
  MapPin,
  Building,
  CreditCard,
  BarChart2,
  Smartphone,
  BanknoteIcon as Bank,
  ShoppingBag,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1632&q=80"
            alt="BUTSACCO team"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-5">
            About BUTSACCO
          </h1>
          <p className="text-xl max-w-3xl">
            Learn about our history, mission, and the impact we've made in our
            community since 2009.
          </p>
        </div>
      </section>

      {/* History Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our History</h2>
              <p className="mb-4">
                BUTSACCO was started on October 9th, 2009 by 36 visionary
                members, the majority of them being teachers, after being
                mobilized by the founder Mr. Baita Jethro, a prominent teacher
                in the area.
              </p>
              <p className="mb-4">
                It was established with a clear purpose: to help teachers and
                other members of the community overcome exploitation from money
                lenders that were common and charging exorbitant interest rates,
                as well as improving the image and status of teachers in the
                community.
              </p>
              <p className="mb-4">
                BUTSACCO was officially registered with the registrar of
                cooperatives in the Ministry of Trade in Uganda on August 9th,
                2011, with registration number 9668RCS. Today, we are supervised
                by the same ministry through the district commercial office and
                the Uganda Micro Finance Regulatory Authority.
              </p>
            </div>
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <Calendar className="h-5 w-5 text-primary mr-2" />
                  <h3 className="text-lg font-semibold">Founded</h3>
                </div>
                <p>October 9th, 2009</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <Users className="h-5 w-5 text-primary mr-2" />
                  <h3 className="text-lg font-semibold">Founding Members</h3>
                </div>
                <p>36 visionary teachers and community members</p>
              </div>

              <div className="bg-slate-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <CheckCircle className="h-5 w-5 text-primary mr-2" />
                  <h3 className="text-lg font-semibold">Registration</h3>
                </div>
                <p>August 9th, 2011 (Registration #9668RCS)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Businesses Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Businesses</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              BUTSACCO is a people's SACCO. Our business is derived from the
              financial demands of the community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Savings Services</h3>
              <p className="text-slate-600">
                We offer a range of savings products including deposits and
                withdrawals to help our members build financial security.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <BarChart2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Credit Services</h3>
              <p className="text-slate-600">
                We extend affordable credit services to our members with
                competitive interest rates and flexible repayment terms.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Mobile Money</h3>
              <p className="text-slate-600">
                We provide mobile money services to facilitate easy transactions
                and financial accessibility for our members.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <Bank className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Agency Banking</h3>
              <p className="text-slate-600">
                We offer agency banking services for leading commercial banks in
                Kasese district, bringing banking closer to you.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Hardware Shop</h3>
              <p className="text-slate-600">
                We operate a hardware shop where we sell hardware items at very
                competitive rates to serve the community's needs.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-4">Service Channels</h3>
              <p className="text-slate-600">
                Our services can be accessed at our main branch, online, or
                through our agents spread throughout the district.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Core Values</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              While getting enough dividends is the ultimate target, BUTSACCO
              members put the customer at the center of planning and nature of
              operation. The more the customer is satisfied with the services
              offered, the more pride BUTSACCO will be.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-xl">C</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Commitment</h3>
              <p className="text-slate-600">
                We are dedicated to serving our members with unwavering
                commitment.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-xl">M</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Member Focus</h3>
              <p className="text-slate-600">
                Our members are at the center of everything we do.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-xl">T</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Team Work</h3>
              <p className="text-slate-600">
                We collaborate to achieve common goals and better serve our
                community.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-xl">H</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Honesty</h3>
              <p className="text-slate-600">
                We operate with integrity and transparency in all our dealings.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <div className="bg-primary/10 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-primary font-bold text-xl">E</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Efficiency</h3>
              <p className="text-slate-600">
                We strive to provide prompt and effective service to our
                members.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Mission & Vision</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-4 text-primary">
                Our Mission
              </h3>
              <p className="mb-4">
                To provide accessible, affordable, and sustainable financial
                services to our members, with a focus on teachers and the
                broader community.
              </p>
              <p>
                We aim to empower our members through financial inclusion,
                education, and support, helping them build a secure future and
                contribute to community development.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-2xl font-semibold mb-4 text-primary">
                Our Vision
              </h3>
              <p className="mb-4">
                To be the leading savings and credit cooperative in Uganda,
                recognized for excellence in financial services, member
                satisfaction, and positive community impact.
              </p>
              <p>
                We envision a community where all members have access to fair
                financial services and the knowledge to make informed financial
                decisions for a prosperous future.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Contact Information</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Get in touch with us through any of these channels. We're here to
              serve you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Phone Contact</h3>
                  <ul className="space-y-2 text-slate-600">
                    <li>
                      Office lines: +256789 529810 and +256779 021565 (during
                      working hours)
                    </li>
                    <li>Manager: +256788 566925</li>
                    <li>Chairperson: +256782 147266</li>
                    <li>WhatsApp: 0788 566925</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Email & Social</h3>
                  <ul className="space-y-2 text-slate-600">
                    <li>Email: bukonzounitedteacherssacco@gmail.com</li>
                    <li>Twitter (X): BUTSACCO</li>
                    <li>LinkedIn: bukonzounitedteacherssacco@gmail.com</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full shrink-0">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">
                    Physical Address
                  </h3>
                  <ul className="space-y-2 text-slate-600">
                    <li>Plot 2 Main Street, Kisinga Bwera Road</li>
                    <li>
                      Located in Kisinga II cell, on Kisinga-Kinyamaseke road
                      about 100 metres from Kisinga town council headquarters
                    </li>
                    <li>P.O. Box 142 Kasese, Uganda</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Leadership</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Meet the dedicated team guiding BUTSACCO towards a brighter
              future.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden w-40 h-40 mx-auto">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
                  alt="Mr. Baita Jethro"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold">Mr. Baita Jethro</h3>
              <p className="text-primary">Founder & Chairperson</p>
              <p className="text-sm text-slate-600 mt-2">
                Contact: +256782 147266
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden w-40 h-40 mx-auto">
                <img
                  src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
                  alt="Ms. Sarah Nakato"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold">Ms. Sarah Nakato</h3>
              <p className="text-primary">General Manager</p>
              <p className="text-sm text-slate-600 mt-2">
                Contact: +256788 566925
              </p>
            </div>

            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden w-40 h-40 mx-auto">
                <img
                  src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
                  alt="Mr. David Okello"
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-xl font-semibold">Mr. David Okello</h3>
              <p className="text-primary">Treasurer</p>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button asChild>
              <Link href="/leadership">View Full Leadership Team</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1e40af] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Join Our Community</h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Become a member today and be part of our mission to create financial
            stability and growth.
          </p>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            <Link href="/membership" className="bg-white">
              Become a Member
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
