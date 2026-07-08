"use client";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import {
  User,
  Mail,
  Phone,
  Briefcase,
  Save,
  Shield,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import ImageInput from "../FormInputs/ImageInput";


const profileSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  jobTitle: z.string().optional(),
  image: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle?: string;
  image?: string;
};
interface UserProfileFormProps {
  currentUser: UserProfile;
}

export default function UserProfileForm({ currentUser }: UserProfileFormProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      phone: currentUser.phone,
      jobTitle: currentUser.jobTitle || "",
    },
  });
  const [loading, setLoading] = useState(false);
  const initialImage = currentUser?.image || "/placeholder.svg";
  const [imageUrl, setImageUrl] = useState(initialImage);

  async function onSubmit(data: ProfileFormValues) {
    setLoading(true);
    data.image = imageUrl;
    try {
      const res = await fetch(`/api/v1/users/${currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Failed to update profile");
        return;
      }

      toast.success("Profile updated successfully");
      setLoading(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 relative overflow-hidden">
      {/* Premium background patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(120,119,198,0.08),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_75%,rgba(59,130,246,0.06),transparent_50%)]"></div>

      {/* Floating geometric shapes */}
      <div className="absolute top-20 right-20 w-32 h-32 rounded-full bg-gradient-to-br from-blue-200/20 to-indigo-200/20 blur-xl"></div>
      <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-gradient-to-tl from-cyan-200/15 to-blue-200/15 blur-2xl"></div>

      <div className="relative z-10 p-6 lg:p-8">
        {/* Premium Header */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-blue-800 bg-clip-text text-transparent">
            Profile Settings
          </h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Manage your personal information and account preferences with
            enterprise-grade security
          </p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-12 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-8 col-span-full space-y-6">
              {/* Personal Information Card */}
              <Card className="border-0 shadow-2xl shadow-slate-900/5 bg-white/80 backdrop-blur-xl overflow-hidden">
                {/* Gradient border effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-200/30 via-transparent to-indigo-200/20 p-[1px] rounded-xl">
                  <div className="rounded-xl bg-white/90 backdrop-blur-sm h-full w-full"></div>
                </div>

                <div className="relative">
                  <CardHeader className="bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-b border-slate-200/50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-800">
                          Personal Information
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          Update your personal details and contact information
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-8">
                    <Form {...form}>
                      <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-6"
                      >
                        {/* Name Fields */}
                        <div className="grid gap-6 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem className="space-y-3">
                                <FormLabel className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <User className="w-4 h-4 text-slate-500" />
                                  <span>First Name</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative group">
                                    <Input
                                      placeholder="John"
                                      {...field}
                                      className="h-12 px-4 bg-slate-50/50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 group-hover:border-slate-300"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 text-xs" />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem className="space-y-3">
                                <FormLabel className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                  <User className="w-4 h-4 text-slate-500" />
                                  <span>Last Name</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative group">
                                    <Input
                                      placeholder="Doe"
                                      {...field}
                                      className="h-12 px-4 bg-slate-50/50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 group-hover:border-slate-300"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 text-xs" />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Email Field (Disabled) */}
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-slate-500" />
                                <span>Email Address</span>
                                <div className="flex items-center space-x-1 ml-2">
                                  <Shield className="w-3 h-3 text-emerald-500" />
                                  <span className="text-xs text-emerald-600 font-medium">
                                    Verified
                                  </span>
                                </div>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    type="email"
                                    placeholder="john@example.com"
                                    {...field}
                                    disabled={true}
                                    className="h-12 px-4 bg-slate-100/80 border-slate-300 text-slate-500 cursor-not-allowed"
                                  />
                                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                  </div>
                                </div>
                              </FormControl>
                              <p className="text-xs text-slate-500 flex items-center space-x-1">
                                <Shield className="w-3 h-3" />
                                <span>
                                  Email address cannot be changed for security
                                  reasons
                                </span>
                              </p>
                              <FormMessage className="text-red-500 text-xs" />
                            </FormItem>
                          )}
                        />

                        {/* Phone Field */}
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-slate-500" />
                                <span>Phone Number</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    type="tel"
                                    placeholder="+1 (555) 123-4567"
                                    {...field}
                                    className="h-12 px-4 bg-slate-50/50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 group-hover:border-slate-300"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 text-xs" />
                            </FormItem>
                          )}
                        />

                        {/* Job Title Field */}
                        <FormField
                          control={form.control}
                          name="jobTitle"
                          render={({ field }) => (
                            <FormItem className="space-y-3">
                              <FormLabel className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
                                <Briefcase className="w-4 h-4 text-slate-500" />
                                <span>Job Title</span>
                                <span className="text-xs text-slate-400 font-normal">
                                  (Optional)
                                </span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative group">
                                  <Input
                                    placeholder="Software Developer"
                                    {...field}
                                    className="h-12 px-4 bg-slate-50/50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 group-hover:border-slate-300"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 text-xs" />
                            </FormItem>
                          )}
                        />

                        {/* Save Button */}
                        <div className="pt-6 border-t border-slate-200/60">
                          <div className="flex justify-end">
                            <Button
                              type="submit"
                              size="lg"
                              disabled={loading}
                              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 transition-all duration-200 font-semibold"
                            >
                              {loading ? (
                                <div className="flex items-center space-x-2">
                                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                  <span>Updating...</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Save className="w-4 h-4" />
                                  <span>Update Profile</span>
                                </div>
                              )}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </Form>
                  </CardContent>
                </div>
              </Card>
            </div>

            {/* Profile Image Section */}
            <div className="lg:col-span-4 col-span-full">
              <div className="sticky top-6">
                <Card className="border-0 shadow-2xl shadow-slate-900/5 bg-white/80 backdrop-blur-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-200/30 via-transparent to-indigo-200/20 p-[1px] rounded-xl">
                    <div className="rounded-xl bg-white/90 backdrop-blur-sm h-full w-full"></div>
                  </div>

                  <div className="relative p-6">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-slate-800 mb-2">
                        Profile Picture
                      </h3>
                      <p className="text-sm text-slate-600">
                        Upload a professional photo
                      </p>
                    </div>

                    <ImageInput
                      title=""
                      imageUrl={imageUrl}
                      setImageUrl={setImageUrl}
                      endpoint="categoryImage"
                    />

                    <div className="mt-4 p-3 bg-slate-50/50 rounded-lg border border-slate-200/50">
                      <div className="flex items-center space-x-2 text-xs text-slate-600">
                        <Shield className="w-3 h-3 text-emerald-500" />
                        <span>Images are encrypted and stored securely</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
