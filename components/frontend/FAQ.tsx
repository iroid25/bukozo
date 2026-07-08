"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronDown, HelpCircle, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "../ui/card";

export default function FAQS() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-emerald-50"></div>
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(45deg, rgba(16,185,129,0.1) 1px, transparent 1px), linear-gradient(-45deg, rgba(16,185,129,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <div className="relative container mx-auto px-4 lg:px-6">
        <div className="text-center mb-20">
          <h2 className="font-bricolage text-5xl lg:text-6xl font-black text-gray-900 mb-6 leading-[1.1]">
            <span className="relative">
              Frequently Asked
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"></div>
            </span>
            <br />
            <span className="text-emerald-600">Questions</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Get answers to common questions about our services and membership
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {[
            {
              question: "Who can become a member of BUTSACCO?",
              answer:
                "BUTSACCO membership is open to all teachers, education professionals, and their immediate family members. We also welcome members of the broader education community.",
            },
            {
              question: "What documents do I need to open an account?",
              answer:
                "You'll need a valid national ID, passport photos, proof of employment in the education sector, and an initial deposit. Our team will guide you through the complete process.",
            },
            {
              question: "How quickly can I get a loan approved?",
              answer:
                "Loan approval typically takes 3-5 business days once all required documents are submitted. Emergency loans can be processed within 24 hours for existing members.",
            },
            {
              question: "Is my money safe with BUTSACCO?",
              answer:
                "Yes, absolutely. We are regulated by the Ministry of Trade and Cooperatives, and all deposits are insured. We also maintain strict security protocols and regular audits.",
            },
            {
              question: "Can I access my account online?",
              answer:
                "Yes, we offer a comprehensive digital banking platform including mobile app access, online transactions, and real-time account monitoring.",
            },
          ].map((faq, index) => (
            <Card
              key={index}
              className="border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-r from-white to-emerald-50/50"
            >
              <CardContent className="p-0">
                <button
                  className="w-full p-8 text-left flex items-center justify-between hover:bg-emerald-50/50 transition-colors rounded-lg"
                  onClick={() => toggleFaq(index)}
                >
                  <span className="font-black text-gray-900 text-lg">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-6 h-6 text-emerald-500 transition-transform duration-300 ${openFaq === index ? "rotate-180" : ""}`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-8 pb-8">
                    <p className="text-gray-600 leading-relaxed text-lg">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
