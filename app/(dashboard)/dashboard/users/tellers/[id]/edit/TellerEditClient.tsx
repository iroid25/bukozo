"use client";

import React, { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  MapPin,
  X,
  Camera,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  Building2,
  CheckCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import TextInput from "@/components/FormInputs/TextInput";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { useUploadThing } from "@/lib/uploadthing";

// Local UserRole enum (matches Prisma schema)
enum UserRole {
  ADMIN = "ADMIN",
  BRANCHMANAGER = "BRANCHMANAGER",
  ACCOUNTANT = "ACCOUNTANT",
  TELLER = "TELLER",
  AGENT = "AGENT",
  MEMBER = "MEMBER",
  LOANOFFICER = "LOANOFFICER",
  AUDITOR = "AUDITOR",
  INSTITUTION = "INSTITUTION",
}
interface TellerEditClientProps {
  data: {
    user: any;
    branches: any[];
  };
}

type UpdateUserFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  nationalId?: string;
  jobTitle?: string;
  branchId?: string;
  isActive: boolean;
  address?: string;
  areaOfOperation?: string;
  image?: string;
  role?: UserRole;
};

type Option = { label: string; value: string };

export default function TellerEditClient({ data }: TellerEditClientProps) {
  const router = useRouter();
  const { user, branches } = data;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateUserFormData>({
    defaultValues: {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      dateOfBirth: user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString().split("T")[0]
        : "",
      nationalId: user.nationalId || "",
      jobTitle: user.jobTitle || "",
      branchId: user.branchId || "",
      isActive: user.isActive,
      address: user.address || "",
      areaOfOperation: user.areaOfOperation || "",
      image: user.image || "",
      role: user.role as UserRole,
    },
  });

  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(
    user.image || "/avatar.avif"
  );
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { startUpload, isUploading } = useUploadThing("profileImage");

  const branchOptions: Option[] = branches.map((branch) => ({
    label: branch.name,
    value: branch.id,
  }));

  const [selectedBranch, setSelectedBranch] = useState<Option>(
    branchOptions.find((b) => b.value === user.branchId) || branchOptions[0]
  );

  const watched = watch();

  // 🔹 Handle image selection and upload via UploadThing
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size/type
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max size is 5MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please upload an image file.",
      });
      return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setImageFile(file);

    try {
      const res = await startUpload([file]);
      const uploadedUrl = res?.[0]?.url as string | undefined;

      console.log("Upload response:", res);
      console.log("Uploaded URL:", uploadedUrl);

      if (!uploadedUrl) throw new Error("Upload failed");

      setValue("image", uploadedUrl);
      console.log("Image URL set in form:", uploadedUrl);
      
      // 🔹 Automatically save the image to the database
      toast.success("Image uploaded! Saving to profile...");
      
      try {
        const saveRes = await fetch(`/api/v1/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            image: uploadedUrl,
          }),
        });
        const result = await saveRes.json();

        if (!saveRes.ok) {
          toast.error("Failed to save image", { description: result.error });
          return;
        }

        toast.success("Profile photo updated successfully!");
        router.refresh(); // Refresh to show the new image
      } catch (saveError) {
        console.error("Error saving image:", saveError);
        toast.error("Failed to save image", { 
          description: "The image was uploaded but couldn't be saved to your profile." 
        });
      }
    } catch (error) {
      console.error("UploadThing error:", error);
      toast.error("Upload failed", { description: "Please try again." });
    }
  };

  // 🔹 Handle form submission
  const onSubmit = async (formData: UpdateUserFormData) => {
    setIsLoading(true);

    try {
      // Ensure we use the latest image value from the form
      const currentImage = formData.image || watched.image || user.image;
      
      const updateData = {
        ...formData,
        branchId: selectedBranch?.value,
        image: currentImage,
      };

      console.log("Submitting user update with data:", updateData);
      console.log("Image URL being sent:", currentImage);

      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error("Update Failed", { description: result.error });
        return;
      }

      toast.success("Success!", {
        description: "User profile updated successfully",
      });

      setTimeout(() => {
        router.push(`/dashboard/user-details/${user.id}`);
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Update Failed", {
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-12">
      {/* Decorative Top Banner */}
      <div className="h-48 w-full bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:24px_24px]"></div>
        <div className="absolute -bottom-1 left-0 right-0 h-16 bg-gradient-to-t from-[#f8fafc] to-transparent"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-24 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Main Form Side */}
          <div className="flex-1 space-y-8">
            {/* Header / Breadcrumbs */}
            <div className="bg-white/80 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl shadow-blue-900/5 mb-2">
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={() => router.back()}
                    className="group flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mb-2"
                  >
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    <span className="text-sm font-medium">Back to Profile</span>
                  </button>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    Edit {user.firstName}'s Profile
                  </h1>
                  <p className="text-slate-500 mt-1">
                    Manage account permissions and personal information
                  </p>
                </div>
                <div className="hidden md:block">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    user.isActive ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"
                  }`}>
                    {user.isActive ? "Active Account" : "Inactive Account"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              {/* Profile Photo Section */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 group">
                <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-50 rounded-2xl">
                      <Camera className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Profile Authentication</h2>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-10">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden ring-4 ring-slate-50 shadow-2xl relative">
                        <img
                          src={imagePreview}
                          alt="Profile"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        {isUploading && (
                          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <label className="absolute -bottom-3 -right-3 bg-blue-600 text-white p-3 rounded-2xl shadow-xl cursor-pointer hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all duration-200 border-4 border-white">
                        <Camera className="w-5 h-5" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                    
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <h4 className="font-bold text-slate-800 text-lg">Identity Photo</h4>
                      <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                        Upload a clear portrait for system identification. Photos save automatically.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase">JPEG</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase">PNG</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md uppercase">Max 5MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-50 rounded-2xl">
                      <User className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">General Information</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <TextInput
                      register={register}
                      errors={errors}
                      name="firstName"
                      label="First Name"
                      placeholder="e.g. John"
                      isRequired
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="lastName"
                      label="Last Name"
                      placeholder="e.g. Doe"
                      isRequired
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="email"
                      label="Email Address"
                      type="email"
                      placeholder="name@bukonzo.com"
                      isRequired
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="phone"
                      label="Active Phone Number"
                      type="tel"
                      placeholder="+256 ..."
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="dateOfBirth"
                      label="Date of Birth"
                      type="date"
                    />
                    <TextInput
                      register={register}
                      errors={errors}
                      name="nationalId"
                      label="National ID Number"
                      placeholder="e.g. NIN, ID Card"
                    />
                  </div>
                </div>
              </div>

              {/* Work & Permissions */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-emerald-50 rounded-2xl">
                      <Building2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Work & System Permissions</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Admin Role Selection - Highlighted */}
                    {isAdmin && (
                      <div className="md:col-span-2 bg-blue-50/50 border border-blue-100 p-6 rounded-2xl mb-2">
                        <div className="flex items-center gap-3 mb-4">
                          <ShieldCheck className="w-5 h-5 text-blue-600" />
                          <Label className="text-blue-900 font-bold uppercase tracking-wider text-xs">Administrative Override: System Role</Label>
                        </div>
                        <select
                          {...register("role")}
                          className="flex h-12 w-full rounded-xl border border-blue-200 bg-white px-4 py-2 text-base font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all appearance-none cursor-pointer"
                        >
                          {Object.values(UserRole).map((r) => (
                            <option key={r as string} value={r as string}>
                              {(r as string).replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        <p className="mt-3 text-xs text-blue-600/70 font-medium">
                          Note: Changing a user's role affects their navigation access and system permissions immediately.
                        </p>
                      </div>
                    )}

                    {user.role === "AGENT" ? (
                      <div className="md:col-span-2">
                        <TextInput
                          register={register}
                          errors={errors}
                          name="areaOfOperation"
                          label="Territory / Area of Operation"
                          placeholder="e.g., Kasese District"
                        />
                      </div>
                    ) : (
                      <>
                        <div>
                          <TextInput
                            register={register}
                            errors={errors}
                            name="jobTitle"
                            label="Official Job Title"
                            placeholder="e.g., Senior Operations Associate"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold text-slate-700 ml-1 mb-1.5 block">Default Assigned Branch</Label>
                          <FormSelectInput
                            label=""
                            options={branchOptions}
                            option={selectedBranch}
                            setOption={setSelectedBranch}
                          />
                        </div>
                      </>
                    )}
                    
                    <div className="md:col-span-2 space-y-2 mt-2">
                      <Label className="text-sm font-bold text-slate-700 ml-1 mb-1.5 block">Physical Residential Address</Label>
                      <Textarea
                        {...register("address")}
                        placeholder="Enter comprehensive address details..."
                        className="min-h-[100px] rounded-2xl border-slate-200 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all resize-none shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-purple-50 rounded-2xl">
                      <CheckCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Account Governance</h2>
                  </div>
                  
                  <div className={`p-6 rounded-2xl transition-colors duration-300 ${watched.isActive ? 'bg-slate-50 border border-slate-100' : 'bg-rose-50 border border-rose-100'}`}>
                    <div className="flex items-start gap-4">
                      <Checkbox
                        id="isActive"
                        checked={watched.isActive}
                        onCheckedChange={(checked) =>
                          setValue("isActive", checked as boolean)
                        }
                        className="mt-1.5 h-5 w-5 rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 transition-all"
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor="isActive"
                          className="text-lg font-bold text-slate-800 cursor-pointer"
                        >
                          Enable User Authentication
                        </Label>
                        <p className={`text-sm ${watched.isActive ? 'text-slate-500' : 'text-rose-600 font-medium'}`}>
                          {watched.isActive 
                            ? "This user is currently authorized to access system dashboards and secure resources."
                            : "Deactivating this account will immediately revoke all access and kill active sessions."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-4 bg-slate-100 p-6 rounded-3xl">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="w-full sm:w-auto px-8 py-6 rounded-2xl font-bold text-slate-600 border-slate-200 hover:bg-slate-200 transition-all active:scale-95"
                  disabled={isLoading}
                >
                  Discard Changes
                </Button>
                <div className="w-full sm:w-auto">
                    <SubmitButton
                    title="Activate Profile Updates"
                    loading={isLoading || isUploading}
                    loadingTitle="Synchronizing..."
                    className="w-full px-12 py-6 rounded-2xl shadow-xl shadow-blue-500/20 font-bold"
                    />
                </div>
              </div>
            </form>
          </div>

          {/* Right Sidebar - Sticky Summary (Desktop Only) */}
          <div className="hidden lg:block w-80">
            <div className="sticky top-8 space-y-6">
              <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 opacity-50"></div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 relative z-10">Quick Summary</h3>
                <div className="space-y-6 relative z-10">
                  <div className="flex items-center gap-4">
                    <img src={imagePreview} className="w-12 h-12 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-bold text-slate-800 leading-tight">{watched.firstName} {watched.lastName}</h4>
                      <p className="text-xs text-slate-500">{watched.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-medium">Platform Role</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{watched.role?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400 font-medium">Current Status</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${user.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-700/20 group cursor-default">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-5 h-5 text-blue-200" />
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Auditing Active</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-blue-50">
                    All modifications to user profiles are logged in the system audit trail for security compliance.
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
