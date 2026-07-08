"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Building, 
  Save, 
  X, 
  Trash2,
  Settings2,
  Globe,
  Briefcase
} from "lucide-react";

import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import type { Branch, BranchCreateDTO } from "@/types/branches";

interface BranchEditFormProps {
  branch: Branch;
}

export default function BranchEditForm({ branch }: BranchEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<BranchCreateDTO>({
    defaultValues: {
      name: branch.name,
      location: branch.location,
      contactPerson: branch.contactPerson || "",
      contactPhone: branch.contactPhone || "",
      email: branch.email || "",
    },
  });

  const handleBack = () => {
    router.push(`/dashboard/branches/${branch.id}`);
  };

  async function onSubmit(data: BranchCreateDTO) {
    try {
      setLoading(true);

      const res = await fetch(`/api/v1/branches/${branch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, id: branch.id }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast.error("Update Failed", { description: result.error });
        return;
      }

      toast.success("Branch Updated", {
        description: "Your changes have been saved successfully.",
      });

      router.push(`/dashboard/branches/${branch.id}`);
      router.refresh();
    } catch (error) {
      toast.error("Sync Error", {
        description: "An unexpected error occurred while saving."
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header with Breadcrumbs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configure Branch</h1>
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-600 border-blue-100 font-bold">
                Management Mode
              </Badge>
            </div>
            <p className="text-sm text-slate-500 font-medium">Updating {branch.name} identity</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={loading}
            className="text-slate-500 hover:text-slate-700 font-semibold"
          >
            Discard Changes
          </Button>
          <Button 
            form="branch-edit-form"
            type="submit"
            disabled={loading || !isDirty}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 px-6"
          >
            {loading ? "Saving..." : "Apply Configuration"}
          </Button>
        </div>
      </div>

      <form id="branch-edit-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Main Form Fields */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-base">Identity & Core Info</CardTitle>
              </div>
              <CardDescription>Primary identification details for this branch</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Branch Identity Name *"
                  name="name"
                  icon={Building}
                  placeholder="e.g. Central Kampala HQ"
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Operational Location *"
                  name="location"
                  icon={MapPin}
                  placeholder="e.g. Plot 4, Kampala Road"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Connectivity Support</CardTitle>
              </div>
              <CardDescription>How users can reach this location or its manager</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Branch Representative"
                  name="contactPerson"
                  icon={User}
                  placeholder="Full Name"
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Direct Support Phone"
                  name="contactPhone"
                  type="tel"
                  icon={Phone}
                  placeholder="+256..."
                />
                <div className="md:col-span-2">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Official Branch Email"
                    name="email"
                    type="email"
                    icon={Mail}
                    placeholder="branch@example.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Context & Meta */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-400" />
                Registry Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-medium">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-slate-400">Registry ID</span>
                <span className="font-mono text-[10px] text-blue-300 truncate max-w-[120px]">{branch.id}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-slate-400">Created On</span>
                <span>{new Date(branch.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Last Meta Update</span>
                <span>{new Date(branch.updatedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-rose-50/30 border border-rose-100 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-rose-900 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" />
                Critical Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-rose-600/80 leading-relaxed font-medium">
                Deleting a branch is permanent and requires no active accounts or loans bound to this unit.
              </p>
              <Button 
                variant="outline" 
                className="w-full border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all font-bold text-xs h-10 rounded-xl"
              >
                Request Retirement
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
