import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart2,
  CreditCard,
  Shield,
  Users,
  Award,
  Clock,
  Landmark,
} from "lucide-react";
import Navbar from "@/components/frontend/currentUiComponents/components/navbar";
import HeroSlider from "@/components/frontend/currentUiComponents/components/hero-slider";
import TestimonialCard from "@/components/frontend/currentUiComponents/components/testimonial-card";
import Footer from "@/components/frontend/currentUiComponents/components/footer";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* <Navbar /> */}

      {/* Hero Slider Section */}
      <HeroSlider />

      {/* Welcome Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-block mb-6">
            <div className="flex items-center justify-center w-16 h-16 mx-autobg-[#1e40af]/10 rounded-full">
              <Landmark className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-4xl font-bold mb-6">
            Welcome to bukonzoUnited Teachers Sacco
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-slate-600 mb-8">
              Established in 2009, we are a member-owned financial cooperative
              dedicated to improving the financial well-being of teachers and
              community members in bukonzoregion through affordable financial
              services, education, and support.
            </p>
            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="flex flex-col items-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2,500+</h3>
                <p className="text-slate-600">Active Members</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">14+ Years</h3>
                <p className="text-slate-600">Of Service</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Excellence</h3>
                <p className="text-slate-600">In Financial Services</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <h2 className="text-3xl font-bold mb-6">Our Founder's Vision</h2>
              <p className="mb-4 text-slate-600">
                Mr. Baita Jethro, a respected teacher in the community, founded
                BUTSACCO with a clear vision: to help teachers and community
                members overcome exploitation from money lenders charging
                exorbitant interest rates and to improve the image and status of
                teachers in the community.
              </p>
              <p className="mb-6 text-slate-600">
                "I envisioned a financial institution that would be owned by
                teachers, run by teachers, and primarily serve teachers. A place
                where members could save, access affordable credit, and build a
                better future for themselves and their families."
              </p>
              <p className="italic text-primary font-medium mb-6">
                - Mr. Baita Jethro, Founder
              </p>
              <Button asChild className="group">
                <Link href="/about">
                  Read Our Full Story{" "}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
            <div className="order-1 md:order-2 flex justify-center">
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-full h-full border-2 border-primary rounded-lg"></div>
                <img
                  src="/images/founder.jpg"
                  alt="Mr. Baita Jethro - Founder of BUTSACCO"
                  className="w-full max-w-md rounded-lg shadow-lg relative z-10"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Services</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              We offer a range of financial services designed to help our
              members achieve financial stability and growth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Savings Accounts</h3>
              <p className="text-slate-600 mb-4">
                Secure and flexible savings options to help you build your
                financial future.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/services/savings">Learn More</Link>
              </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <BarChart2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Affordable Loans</h3>
              <p className="text-slate-600 mb-4">
                Low-interest loans for education, business, agriculture, and
                personal needs.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/services/loans">Learn More</Link>
              </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">
                Financial Education
              </h3>
              <p className="text-slate-600 mb-4">
                Training and resources to help members make informed financial
                decisions.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/services/education">Learn More</Link>
              </Button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Investment Options</h3>
              <p className="text-slate-600 mb-4">
                Opportunities to grow your wealth through various investment
                products.
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/services/investment">Learn More</Link>
              </Button>
            </div>
          </div>

          <div className="text-center mt-10">
            <Button asChild>
              <Link href="/services">View All Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Member Success Stories</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Hear from our members about how BUTSACCO has helped them achieve
              their financial goals.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="BUTSACCO helped me secure a loan to expand my small business. Now I employ three people from our community."
              name="Sarah Namukasa"
              role="Business Owner"
              image="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
            />

            <TestimonialCard
              quote="As a teacher, I was able to build my dream home through BUTSACCO's affordable housing loan program."
              name="John Mukasa"
              role="Secondary School Teacher"
              image="https://images.unsplash.com/photo-15fou60250097-0b93528c311a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=687&q=80"
            />

            <TestimonialCard
              quote="The financial literacy workshops organized by BUTSACCO changed how I manage my family's finances."
              name="Grace Atim"
              role="Community Member"
              image="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=764&q=80"
            />
          </div>
        </div>
      </section>

      {/* Mobile Banking Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1470&q=80"
                alt="Mobile Banking"
                className="rounded-lg shadow-lg"
              />
            </div>
            <div>
              <h2 className="text-3xl font-bold mb-6">Mobile Money Services</h2>
              <p className="mb-6 text-slate-600">
                We've partnered with leading mobile money providers to make
                banking more convenient for you. Receive loans and make payments
                easily through your mobile phone.
              </p>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-center">
                  <img
                    src="https://i.pinimg.com/736x/ff/d2/53/ffd25314b0512b9b6e2a9ba6f1a35fb3.jpg"
                    alt="MTN Mobile Money"
                    className="h-12 w-12 mr-4"
                  />
                  <span className="font-medium">MTN Mobile Money</span>
                </div>
                <div className="flex items-center">
                  <img
                    src="https://i.pinimg.com/736x/43/c7/aa/43c7aa891a73a997e3d014b88d06077a.jpg"
                    alt="Airtel Money"
                    className="h-12 w-12 mr-4"
                  />
                  <span className="font-medium">Airtel Money</span>
                </div>
              </div>
              <Button asChild>
                <Link href="/services/mobile-money">
                  Learn More About Mobile Services
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1e40af] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Join Our Growing Community
          </h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Become a member today and start your journey towards financial
            freedom and stability.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
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
