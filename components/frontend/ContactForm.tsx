import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";

export default function ContactForm() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-emerald-50/50 to-white"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(16,185,129,0.2) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Get In
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
            </span>
            <span className="text-emerald-600"> Touch</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Ready to start your financial journey? Send us a message and we'll
            get back to you within 24 hours.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Contact Form */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-emerald-50/50">
            <CardHeader className="pb-6">
              <CardTitle className="font-bricolage text-3xl font-black text-gray-900 leading-[1.2]">
                Send us a message
              </CardTitle>
              <CardDescription className="text-gray-600 text-lg">
                Fill out the form below and our team will respond promptly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    First Name
                  </label>
                  <Input
                    className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl h-12"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Last Name
                  </label>
                  <Input
                    className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl h-12"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <Input
                  className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl h-12"
                  type="email"
                  placeholder="john.doe@email.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Phone Number
                </label>
                <Input
                  className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl h-12"
                  placeholder="+256 700 123 456"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Subject
                </label>
                <Input
                  className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl h-12"
                  placeholder="Account Opening Inquiry"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">
                  Message
                </label>
                <Textarea
                  className="border-2 border-emerald-100 focus:border-emerald-500 rounded-xl min-h-32"
                  placeholder="Tell us how we can help you..."
                />
              </div>

              <Button className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                <Send className="w-5 h-5 mr-2" />
                Send Message
              </Button>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="grid gap-8">
              <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <MapPin className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bricolage text-2xl font-black text-gray-900 mb-4 leading-[1.2]">
                    Visit Our Office
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    bukonzo, Kampala
                    <br />
                    Plot 123, Teachers' Plaza
                    <br />
                    Uganda
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Phone className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bricolage text-2xl font-black text-gray-900 mb-4 leading-[1.2]">
                    Call Us
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    +256 700 123 456
                    <br />
                    +256 414 123 456
                    <br />
                    Mon-Fri: 8AM-5PM
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/50">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-bricolage text-2xl font-black text-gray-900 mb-4 leading-[1.2]">
                    Email Us
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    info@butsacco.co.ug
                    <br />
                    support@butsacco.co.ug
                    <br />
                    loans@butsacco.co.ug
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
