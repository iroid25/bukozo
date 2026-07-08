// app/dashboard/users/tellers/[id]/edit/TellerEditClient.tsx
"use client";
import React, { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  MapPin,
  Save,
  X,
  Camera,
  Loader2,
  ArrowLeft,
  Building2,
  CheckCircle,
} from "lucide-react";
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
};

type Option = { label: string; value: string };

export default function AgentEditClient({ data }: TellerEditClientProps) {
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
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(
    user.image || "/avatar.avif"
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const branchOptions: Option[] = branches.map((branch) => ({
    label: branch.name,
    value: branch.id,
  }));

  const [selectedBranch, setSelectedBranch] = useState<Option>(
    branchOptions.find((b) => b.value === user.branchId) || branchOptions[0]
  );

  const watched = watch();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", {
        description: "Please select an image smaller than 5MB",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type", {
        description: "Please select an image file",
      });
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload image to server
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);

      const response = await fetch("/api/upload/profile-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const result = await response.json();
      setValue("image", result.imageUrl);

      toast.success("Image uploaded", {
        description: "Profile image uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Upload failed", {
        description:
          "Failed to upload image. You can still save other changes.",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (formData: UpdateUserFormData) => {
    setIsLoading(true);

    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        nationalId: formData.nationalId || undefined,
        jobTitle: formData.jobTitle || undefined,
        branchId: selectedBranch.value || undefined,
        isActive: formData.isActive,
        address: formData.address || undefined,
        areaOfOperation: formData.areaOfOperation || undefined,
        image: watched.image || undefined,
      };

      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error("Update Failed", {
          description: result.error,
        });
        return;
      }

      toast.success("Success!", {
        description: "User profile updated successfully",
      });

      setTimeout(() => {
        router.push(
          `/dashboard/user-details/${result.data?.member?.id || user.id}`
        );
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            Edit {user.role.charAt(0) + user.role.slice(1).toLowerCase()}{" "}
            Profile
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Update user information and settings
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 sm:space-y-6"
        >
          {/* Profile Image Section */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
              Profile Photo
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Profile"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-gray-100"
                />
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                  {uploadingImage ? (
                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs sm:text-sm text-gray-600 mb-2">
                  Upload a professional photo. Max size: 5MB
                </p>
                <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="font-medium text-gray-700">
                    {uploadingImage ? "Uploading..." : "Choose File"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                {uploadingImage && (
                  <p className="text-xs text-blue-600 mt-2">
                    Uploading image...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              Personal Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput
                register={register}
                errors={errors}
                name="firstName"
                label="First Name"
                icon={User}
                placeholder="Enter first name"
                isRequired={true}
              />

              <TextInput
                register={register}
                errors={errors}
                name="lastName"
                label="Last Name"
                icon={User}
                placeholder="Enter last name"
                isRequired={true}
              />

              <TextInput
                register={register}
                errors={errors}
                name="email"
                label="Email Address"
                icon={Mail}
                type="email"
                placeholder="email@example.com"
                isRequired={true}
              />

              <TextInput
                register={register}
                errors={errors}
                name="phone"
                label="Phone Number"
                icon={Phone}
                type="tel"
                placeholder="+256 700 000 000"
                isRequired={false}
              />

              <TextInput
                register={register}
                errors={errors}
                name="dateOfBirth"
                label="Date of Birth"
                icon={Calendar}
                type="date"
                isRequired={false}
              />

              <TextInput
                register={register}
                errors={errors}
                name="nationalId"
                label="National ID"
                icon={CreditCard}
                placeholder="CM90050123456X"
                isRequired={false}
              />
            </div>
          </div>

          {/* Work Information */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
              Work Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.role === "AGENT" ? (
                <div className="md:col-span-2">
                  <TextInput
                    register={register}
                    errors={errors}
                    name="areaOfOperation"
                    label="Area of Operation"
                    icon={MapPin}
                    placeholder="e.g., Kampala Central"
                    isRequired={false}
                  />
                </div>
              ) : (
                <>
                  <TextInput
                    register={register}
                    errors={errors}
                    name="jobTitle"
                    label="Job Title"
                    icon={User}
                    placeholder="e.g., Senior Teller"
                    isRequired={false}
                  />

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Branch *
                    </Label>
                    <FormSelectInput
                      label=""
                      options={branchOptions}
                      option={selectedBranch}
                      setOption={setSelectedBranch}
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2 space-y-2">
                <Label className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Address
                </Label>
                <Textarea
                  {...register("address")}
                  placeholder="Enter full address"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              Account Status
            </h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isActive"
                  checked={watched.isActive}
                  onCheckedChange={(checked) =>
                    setValue("isActive", checked as boolean)
                  }
                />
                <div>
                  <Label
                    htmlFor="isActive"
                    className="font-medium text-gray-900 cursor-pointer"
                  >
                    Active Account
                  </Label>
                  <p className="text-sm text-gray-500">
                    User can login and access the system
                  </p>
                </div>
              </div>

              {!watched.isActive && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <X className="w-4 h-4 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">
                    This user will not be able to login or access the system
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="w-full sm:w-auto"
              disabled={isLoading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <SubmitButton
              title="Save Changes"
              loading={isLoading || uploadingImage}
              loadingTitle="Saving..."
            />
          </div>
        </form>
      </div>
    </div>
  );
}
