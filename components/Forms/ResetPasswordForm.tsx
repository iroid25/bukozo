"use client";
import { AlertCircle, ChevronLeft, Key, Loader2, Lock } from "lucide-react";
import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/button";
import PasswordInput from "../FormInputs/PasswordInput";
import Image from "next/image";

export type ResetProps = {
  cPassword: string;
  password: string;
};

export default function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<ResetProps>();
  const params = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  const [passErr, setPassErr] = useState("");
  const router = useRouter();

  async function onSubmit(data: ResetProps) {
    if (data.cPassword !== data.password) {
      setPassErr("Passwords do not match");
      return;
    }
    
    try {
      setLoading(true);
      setPassErr("");
      
      // Call API instead of server action
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          newPassword: data.password,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setLoading(false);
        setPassErr(result.error || "Invalid or expired reset link");
        return;
      }

      toast.success("Password reset successfully. Please login with your new password.");
      router.push("/login");
    } catch (error) {
      setLoading(false);
      toast.error("Failed to reset password. Please try again.");
    }
  }

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
                src="/illustrations/reset-password.png"
                alt="Reset Password Illustration"
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
            <h2 className="text-3xl font-bold text-slate-800">Secure New Password</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Create a strong password to protect your account and financial data.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
              <PasswordInput
                register={register}
                errors={errors}
                label="New Password"
                name="password"
                icon={Lock}
                placeholder="••••••••"
                className="h-14 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500 transition-all text-slate-700 placeholder:text-slate-400"
              />
              <PasswordInput
                register={register}
                errors={errors}
                label="Confirm Password"
                name="cPassword"
                icon={Key}
                placeholder="••••••••"
                className="h-14 bg-slate-50/50 border-slate-200 focus:bg-white focus:ring-blue-500 transition-all text-slate-700 placeholder:text-slate-400"
              />

              {passErr && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 animate-in slide-in-from-top-1">
                  <AlertCircle className="size-5 shrink-0" />
                  <p className="text-sm font-semibold">{passErr}</p>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg transition-all active:scale-[0.98] shadow-md shadow-emerald-200"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          <div className="pt-4 flex justify-center border-t border-slate-50">
            <Link
              href="/login"
              className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors group"
            >
              <ChevronLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
              Return to Sign In
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
