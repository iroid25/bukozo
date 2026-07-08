"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Link from "next/link";
import { useState } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Shield, Users } from "lucide-react";
import { signIn } from "next-auth/react";
import BukotoSaccoLogo from "../global/Logo";

// Define the validation schema with Zod
const loginSchema = z.object({
  identifier: z.string().min(3, { message: "Please enter a valid email or phone number" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
});

// Type for the form values
export type LoginFormValues = z.infer<typeof loginSchema>;

export default function BukotoSaccoLoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Initialize react-hook-form with zod validation
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl");
  const returnUrl = params.get("returnUrl");
  const [passErr, setPassErr] = useState("");

  async function onSubmit(data: LoginFormValues) {
    try {
      setIsLoading(true);
      setPassErr("");
      console.log("Attempting to sign in with credentials:", data);
      const loginData = await signIn("credentials", {
        ...data,
        redirect: false,
      });
      console.log("SignIn response:", loginData);
      if (loginData?.error) {
        setIsLoading(false);
        toast.error("Sign-in error", {
          description:
            "Please check your credentials or make sure you verified your email",
        });
        setPassErr("Wrong Credentials|Not Verified, Check again");
      } else {
        form.reset();
        setIsLoading(false);
        toast.success("Login Successful");
        setPassErr("");

        const targetParams = new URLSearchParams();
        if (callbackUrl) targetParams.set("callbackUrl", callbackUrl);
        if (returnUrl) targetParams.set("returnUrl", returnUrl);

        const response = await fetch(
          `/api/auth/post-login${targetParams.toString() ? `?${targetParams.toString()}` : ""}`,
        );
        const result = await response.json();

        router.push(result.nextUrl || callbackUrl || returnUrl || "/dashboard");
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Network Error:", error);
    }
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center px-4 py-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="w-full max-w-md relative">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header Section with SACCO Branding */}
          <div className="text-center">
            {/* SACCO Logo */}
            {/* <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30">
                <div className="flex flex-col items-center justify-center text-white">
                  <span className="text-lg font-bold">BT</span>
                  <div className="w-6 h-0.5 bg-white/80 rounded mt-0.5"></div>
                </div>
              </div>
            </div> */}

            {/* SACCO Name */}
            {/* <div className="text-white">
              <h1 className="text-xl font-bold mb-1">BUKOTO TEACHERS</h1>
              <p className="text-emerald-100 text-sm font-medium tracking-wide">
                SACCO LIMITED
              </p>
              <div className="flex items-center justify-center mt-3 space-x-2 text-emerald-100 text-xs">
                <Shield className="w-3 h-3" />
                <span>Secure Portal Access</span>
              </div>
            </div> */}
          </div>

          {/* Form Section */}
          <div className="px-8 py-8">
            <div className="flex items-center justify-center text-center flex-col mb-4">
              <Link href={"/"}>BUTSACO LOGIN</Link>
              <p className="pt-3 text-gray-600 text-sm">
                Sign in to access your SACCO account
              </p>
            </div>

            {/* Error Message */}
            {passErr && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm text-center">{passErr}</p>
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5 z-[999]"
              >
                <FormField
                  control={form.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 font-medium">
                        Email or Phone
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Enter your email or phone"
                            className="pl-10 h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-2">
                        <FormLabel className="text-gray-700 font-medium">
                          Password
                        </FormLabel>
                        <Button
                          asChild
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-emerald-600 hover:text-emerald-800 font-semibold"
                        >
                          <Link href="/forgot-password">
                            Forgot Password?
                          </Link>
                        </Button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="pl-10 pr-12 h-12 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-500" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  className="w-full h-12 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold rounded-lg shadow-lg transition-all duration-200"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4" />
                      <span>Sign In to SACCO</span>
                    </div>
                  )}
                </Button>
              </form>
            </Form>

            {/* Additional Links */}
            {/* <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                New member?{" "}
                <Link
                  href="/auth/register"
                  className="text-emerald-600 hover:text-emerald-800 font-medium"
                >
                  Apply for membership
                </Link>
              </p>
            </div> */}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center space-x-4 text-gray-500 text-xs">
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3" />
              <span>Secure & Licensed</span>
            </div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3" />
              <span>Member Protection</span>
            </div>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            © 2025 bukonzo Teachers SACCO Limited. All rights reserved.
          </p>
        </div>
      </div>
    </section>
  );
}
