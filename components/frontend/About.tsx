import { Badge } from "lucide-react";
import Image from "next/image";
import React from "react";

export default function About() {
  return (
    <section id="about" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-emerald-50/30 to-white"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(16,185,129,0.3) 2px, transparent 0)`,
            backgroundSize: "80px 80px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-10">
            <div>
              <Badge className="bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 mb-6 px-4 py-2 font-semibold">
                About BUTSACCO
              </Badge>

              <h2 className=" text-5xl lg:text-6xl font-black text-gray-900 mb-8 leading-[1.1]">
                <span className="relative">
                  Empowering
                  {/* <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div> */}
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                  Teachers
                </span>
                <br />
                Through Financial
                <br />
                <span className="text-gray-700">Cooperation</span>
              </h2>

              <p className="text-xl text-gray-600 leading-relaxed">
                Founded in 2009, bukonzo Teachers' SACCO has been at the
                forefront of providing accessible financial services to
                educators and their communities. We understand the unique
                financial needs of teachers and have built our services around
                creating sustainable wealth and financial security.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200">
                <div className="text-4xl font-black text-emerald-600">15+</div>
                <div className="text-gray-700 font-semibold">
                  Years of Service
                </div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200">
                <div className="text-4xl font-black text-emerald-600">
                  5,000+
                </div>
                <div className="text-gray-700 font-semibold">
                  Active Members
                </div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200">
                <div className="text-4xl font-black text-emerald-600">
                  UGX 50B+
                </div>
                <div className="text-gray-700 font-semibold">Total Savings</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200">
                <div className="text-4xl font-black text-emerald-600">98%</div>
                <div className="text-gray-700 font-semibold">
                  Satisfaction Rate
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Image
              src="/images/logo.jpg"
              width="600"
              height="400"
              alt="Teachers collaborating"
              className="rounded-3xl shadow-lg"
            />
            <div className="absolute -bottom-8 -left-8 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white p-8 rounded-2xl shadow-lg border-4 border-white">
              <div className="text-3xl font-black">Digital First</div>
              <div className="text-emerald-100 font-medium">
                Modern banking solutions
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
