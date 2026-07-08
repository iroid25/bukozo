import React from "react";
import { Button } from "../ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700"></div>
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 2px, transparent 0)`,
            backgroundSize: "60px 60px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6 text-center">
        <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1]">
          Ready to Start Your
          <br />
          <span className="bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">
            Financial Journey?
          </span>
        </h2>
        <p className="text-xl text-emerald-100 mb-12 max-w-3xl mx-auto leading-relaxed">
          Join thousands of teachers who have chosen BUTSACCO for their
          financial growth and security
        </p>
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Button
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-white font-black px-10 py-5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Sparkles className="mr-2 w-6 h-6" />
            Open Account Now
            <ArrowRight className="ml-2 w-6 h-6" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-emerald-300 text-emerald-100 hover:bg-emerald-800/50 backdrop-blur-sm px-10 py-5 rounded-2xl font-bold transition-all duration-300"
          >
            Schedule Consultation
          </Button>
        </div>
      </div>
    </section>
  );
}
