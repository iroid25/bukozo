import { Clock, Shield, TrendingUp, Users } from "lucide-react";
import React from "react";

export default function WhyUs() {
  return (
    <section id="why-us" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-emerald-50"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(rgba(16,185,129,0.1) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Why Choose
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
            </span>
            <br />
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              BUTSACCO?
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Experience the difference of banking with a cooperative that truly
            understands educators
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: Users,
              title: "Teacher-Focused",
              description:
                "Designed specifically for educators and their unique financial needs",
            },
            {
              icon: Shield,
              title: "Secure & Trusted",
              description:
                "15+ years of reliable service with robust security measures",
            },
            {
              icon: TrendingUp,
              title: "Competitive Rates",
              description:
                "Best-in-market interest rates on savings and affordable loan rates",
            },
            {
              icon: Clock,
              title: "Quick Service",
              description: "Fast loan approvals and efficient customer service",
            },
          ].map((feature, index) => (
            <div key={index} className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <feature.icon className="w-10 h-10 text-white" />
              </div>
              <h3 className="font-bricolage text-2xl font-black text-gray-900 mb-4 leading-[1.2]">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
