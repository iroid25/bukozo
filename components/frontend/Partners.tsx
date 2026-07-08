import Image from "next/image";
import React from "react";

export default function Partners() {
  return (
    <section className="py-16 bg-gradient-to-r from-gray-50 to-emerald-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(rgba(16,185,129,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-12">
          <p className="text-gray-600 font-medium text-lg">
            Trusted by leading educational institutions
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-center">
              <Image
                src="/placeholder.svg"
                width="140"
                height="70"
                alt={`Partner ${i}`}
                className="grayscale hover:grayscale-0 transition-all duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
