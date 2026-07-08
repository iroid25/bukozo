import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white overflow-hidden pt-20">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 px-4 py-2 text-sm font-medium">
              Empowering Teachers Since 2009
            </Badge>

            <div className="space-y-6">
              <h1 className="font-bricolage text-5xl lg:text-7xl font-black leading-[1.1]">
                <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                  Your Financial
                </span>
                <br />
                <span className="relative">
                  <span className="bg-gradient-to-r from-emerald-300 to-emerald-100 bg-clip-text text-transparent">
                    Partner
                  </span>
                  {/* <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full"></div> */}
                </span>
                <br />
                <span className="text-emerald-100">for Growth</span>
              </h1>

              <p className="text-xl text-emerald-100 leading-relaxed max-w-lg">
                BUTSACCO provides affordable savings and loan services designed
                specifically for teachers and their communities. Build your
                financial future with us.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-white font-bold px-8 h-12 py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Sparkles className="mr-2 w-5 h-5" />
                Open Account Today
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-emerald-300 text-emerald-800 hover:text-white hover:bg-emerald-800/50 backdrop-blur-sm h-12 px-8 py-4 rounded-2xl  font-semibold transition-all duration-300"
              >
                Learn More
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-lg">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-200 font-medium">
                    Account Balance
                  </span>
                  <Badge className="bg-gradient-to-r from-green-500 to-green-400 text-white font-semibold">
                    Active
                  </Badge>
                </div>
                <div className="text-4xl font-black text-white">
                  UGX 2,450,000
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <div className="text-sm text-emerald-200 font-medium">
                      Savings
                    </div>
                    <div className="text-xl font-bold text-white">
                      UGX 1,800,000
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <div className="text-sm text-emerald-200 font-medium">
                      Loan Limit
                    </div>
                    <div className="text-xl font-bold text-white">
                      UGX 5,400,000
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
