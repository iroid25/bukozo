import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Eye, Target } from "lucide-react";

export default function MissionAndVision() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-emerald-50"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(45deg, rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(-45deg, rgba(16,185,129,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Our Purpose
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
            </span>
            <span className="text-emerald-600"> & Vision</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Driving financial inclusion and empowerment in the education sector
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Target className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="font-bricolage text-3xl font-black text-gray-900 leading-[1.2]">
                Our Mission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center leading-relaxed text-lg">
                To provide accessible, affordable, and innovative financial
                services that empower teachers and their communities to achieve
                financial stability, growth, and prosperity through cooperative
                principles.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50">
            <CardHeader className="text-center pb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Eye className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="font-bricolage text-3xl font-black text-gray-900 leading-[1.2]">
                Our Vision
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-center leading-relaxed text-lg">
                To be the leading financial cooperative in Uganda, recognized
                for transforming the financial landscape of the education sector
                and fostering sustainable community development.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
