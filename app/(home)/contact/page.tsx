import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import ContactForm from "@/components/frontend/currentUiComponents/components/contact-form";

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1474&q=80"
            alt="BUTSACCO contact"
            className="w-full h-full object-cover brightness-[0.4]"
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-24 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Contact Us</h1>
          <p className="text-xl max-w-3xl">
            We&apos;re here to help. Reach out to us with any questions or
            inquiries.
          </p>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>
              <p className="mb-8 text-slate-600">
                Have questions about our services or want to learn more about
                becoming a member? Our friendly team is here to help you.
                Contact us through any of the channels below.
              </p>

              <div className="grid gap-6">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <MapPin className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Our Location
                      </h3>
                      <p className="text-slate-600">
                        123 Main Street, Kampala, Uganda
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Phone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Phone Number
                      </h3>
                      <p className="text-slate-600">+256 123 456 789</p>
                      <p className="text-slate-600">+256 987 654 321</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Email Address
                      </h3>
                      <p className="text-slate-600">info@butsacco.ug</p>
                      <p className="text-slate-600">support@butsacco.ug</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">
                        Business Hours
                      </h3>
                      <p className="text-slate-600">
                        Monday - Friday: 8:00 AM - 5:00 PM
                      </p>
                      <p className="text-slate-600">
                        Saturday: 9:00 AM - 1:00 PM
                      </p>
                      <p className="text-slate-600">Sunday: Closed</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6">Send Us a Message</h2>
              <p className="mb-8 text-slate-600">
                Fill out the form below and we&apos;ll get back to you as soon
                as possible.
              </p>

              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Location</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              Visit us at our office in Kampala. We&apos;re conveniently located
              and easy to find.
            </p>
          </div>

          <div className="rounded-lg overflow-hidden shadow-lg h-[400px]">
            {/* This would be replaced with an actual Google Maps embed */}
            <div className="w-full h-full bg-slate-200 flex items-center justify-center">
              <p className="text-slate-600">
                Google Maps would be embedded here
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Branch Locations */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Branches</h2>
            <p className="max-w-2xl mx-auto text-slate-600">
              We have multiple branches across Uganda to serve you better.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">
                  Kampala Main Branch
                </h3>
                <div className="space-y-3 text-slate-600">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p>123 Main Street, Kampala</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>+256 123 456 789</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>kampala@butsacco.ug</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Entebbe Branch</h3>
                <div className="space-y-3 text-slate-600">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>456 Lake Road, Entebbe</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>+256 234 567 890</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>entebbe@butsacco.ug</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Jinja Branch</h3>
                <div className="space-y-3 text-slate-600">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>789 Nile Avenue, Jinja</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>+256 345 678 901</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-[#1e40af]   shrink-0 mt-0.5" />
                    <p>jinja@butsacco.ug</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1e40af] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Join BUTSACCO?</h2>
          <p className="max-w-2xl mx-auto mb-8 text-white/90">
            Take the first step towards financial freedom and stability by
            becoming a member today.
          </p>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
          >
            <Link href="/membership">Become a Member</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
