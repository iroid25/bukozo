"use client";
import { AlertCircle, ChevronLeft, Loader2, Mail } from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { ForgotPasswordProps } from "@/types/types";
import toast from "react-hot-toast";
import TextInput from "../FormInputs/TextInput";
import { Button } from "../ui/button";
import Image from "next/image";

export default function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ForgotPasswordProps>();
  const [passErr, setPassErr] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [email, setEmail] = useState("");

  const router = useRouter();

  async function onSubmit(data: ForgotPasswordProps) {
    try {
      setLoading(true);
      setPassErr("");
      setEmail(data.email);
      
      // Call API instead of server action
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (!result.success) {
        setLoading(false);
        setPassErr(result.error || "User not found or error occurred");
        return;
      }

      toast.success(result.message || "Verification code sent!");
      
      // In development, show the token if available
      if (result.token) {
        toast.success(`DEV MODE: Your reset code is ${result.token}`, { duration: 10000 });
      }
      
      router.push(`/verify-account?email=${data.email}`);
    } catch (error) {
      setLoading(false);
      toast.error("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col items-center justify-center p-4">
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
                src="/illustrations/forgot-password.png"
                alt="Forgot Password Illustration"
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
            <h2 className="text-3xl font-bold text-slate-800">Forgot Password</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Enter your email and we'll send you a code to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Email Address"
                  name="email"
                  icon={Mail}
                  placeholder="Enter your email"
                  className="h-14 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500 transition-all text-slate-700 placeholder:text-slate-400"
                />
              </div>

              {passErr && (
                <div className="flex items-center gap-2 text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="size-4" />
                  <span>{passErr}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-md shadow-emerald-200"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Sending code...</span>
                </div>
              ) : (
                "Submit"
              )}
            </Button>
          </form>

          <div className="pt-4 flex justify-center">
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors group"
            >
              <ChevronLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              Back to Login
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
