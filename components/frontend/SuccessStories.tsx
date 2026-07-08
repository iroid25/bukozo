import Image from "next/image";
import React from "react";
import { Card, CardContent } from "../ui/card";
import { Star } from "lucide-react";

export default function SuccessStories() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-emerald-50/30 to-white"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(16,185,129,0.2) 2px, transparent 0)`,
            backgroundSize: "60px 60px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Success
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
            </span>
            <span className="text-emerald-600"> Stories</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Real stories from our members who have achieved their financial
            goals with BUTSACCO
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              name: "Sarah Nakato",
              role: "Primary School Teacher",
              content:
                "BUTSACCO helped me buy my first home with their affordable loan rates. The process was smooth and the staff was incredibly supportive.",
              image: "/placeholder.svg",
            },
            {
              name: "James Okello",
              role: "Secondary School Teacher",
              content:
                "The digital banking platform is fantastic. I can manage all my finances from my phone, which is perfect for my busy schedule.",
              image: "/placeholder.svg",
            },
            {
              name: "Mary Achieng",
              role: "University Lecturer",
              content:
                "Thanks to BUTSACCO's investment plans, I've been able to secure my retirement. Their financial advisory team is excellent.",
              image: "/placeholder.svg",
            },
          ].map((story, index) => (
            <Card
              key={index}
              className="border-0 shadow-md hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-emerald-50/50"
            >
              <CardContent className="p-8">
                <div className="flex items-center mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className="w-5 h-5 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed text-lg">
                  "{story.content}"
                </p>
                <div className="flex items-center">
                  <Image
                    src={story.image || "/placeholder.svg"}
                    width="56"
                    height="56"
                    alt={story.name}
                    className="rounded-full mr-4 border-2 border-emerald-200"
                  />
                  <div>
                    <div className="font-black text-gray-900 text-lg">
                      {story.name}
                    </div>
                    <div className="text-emerald-600 font-semibold">
                      {story.role}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
