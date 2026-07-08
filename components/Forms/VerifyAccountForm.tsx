"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Shield, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import Link from "next/link";

export default function VerifyAccountForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a complete 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError("");
      
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const res = await response.json();
      
      if (response.ok) {
        toast.success("Identity verified successfully!");
        router.push(`/reset-password?token=${otp}&email=${email}`);
      } else {
        setError(res.error || "Invalid code. Please try again.");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error("Failed to resend");

      toast.success("New code sent to your email");
    } catch (err) {
      toast.error("Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-sans">
      {/* Branding Header */}
      <div className="absolute top-8 left-8 hidden md:block">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-600">BUTSACO</span> 
          <span className="text-slate-400 font-medium">Portal</span>
        </h1>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col md:grid md:grid-cols-2 min-h-[600px]">
        {/* Left Side: Illustration */}
        <div className="bg-slate-50/50 flex items-center justify-center p-12 relative overflow-hidden">
          <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
            {/* Dashed Circular Border */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-200 animate-[spin_60s_linear_infinite]"></div>
            
            {/* Static Illustration */}
            <div className="w-full h-full relative z-10 p-8">
              <Image
                src="/illustrations/verify-account.png"
                alt="Verify Account Illustration"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="flex flex-col justify-center p-8 md:p-16 space-y-8 bg-white">
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-slate-800">Verify Identity</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              We've sent a 6-digit code to <span className="text-blue-600 font-semibold">{email}</span>. Please enter it below to verify your account.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-10">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  setError("");
                }}
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  <InputOTPSlot index={0} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                  <InputOTPSlot index={1} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                  <InputOTPSlot index={2} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                  <InputOTPSlot index={3} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                  <InputOTPSlot index={4} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                  <InputOTPSlot index={5} className="size-12 sm:size-14 text-xl font-bold bg-slate-50 border-slate-200 text-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all border-2" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
                <Shield className="size-5 shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <Button 
                type="submit" 
                className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-md shadow-emerald-200"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  "Confirm Verification"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                disabled={resending}
                className="w-full h-12 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all font-semibold"
              >
                {resending ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Resending...</span>
                  </div>
                ) : (
                  "Didn't get the code? Resend"
                )}
              </Button>
            </div>
          </form>

          <div className="pt-4 flex justify-center border-t border-slate-50">
            <Link
              href="/forgot-password"
              className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors group"
            >
              <ChevronLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              Back to Forgot Password
            </Link>
          </div>
        </div>
      </div>

      {/* Modern Footer */}
      <footer className="mt-12 text-center text-xs text-slate-400 font-medium">
        <p>Created with ❤️ by BUTSACO Tech Team, Copyright © 2026</p>
      </footer>
    </div>
  );
}

