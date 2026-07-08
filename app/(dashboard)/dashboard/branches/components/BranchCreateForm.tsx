"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { MapPin, User, Phone, Mail, Building } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";

import { useRouter } from "next/navigation";
import { BranchCreateDTO } from "@/types/branches";
import InitialFundingModal from "./InitialFundingModal";

export default function BranchCreateForm({
  initialData,
  editingId,
  isOpen,
  onClose,
  accountants = [],
  managers = [],
}: {
  initialData?: Partial<BranchCreateDTO>;
  editingId?: string;
  isOpen: boolean;
  onClose: () => void;
  accountants?: any[];
  managers?: any[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BranchCreateDTO>({
    defaultValues: {
      name: initialData?.name || "",
      location: initialData?.location || "",
      contactPerson: initialData?.contactPerson || "",
      contactPhone: initialData?.contactPhone || "",
      email: initialData?.email || "",
      accountantId: initialData?.accountantId || "",
      managerId: initialData?.managerId || "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [createdBranch, setCreatedBranch] = useState<any>(null);
  const router = useRouter();

  async function saveBranch(data: BranchCreateDTO) {
    try {
      setLoading(true);

      const url = editingId ? `/api/v1/branches/${editingId}` : "/api/v1/branches";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(
          editingId ? "Failed to Update Branch" : "Failed to Create Branch",
          {
            description: result.error || "Something went wrong",
          }
        );
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success(
        editingId
          ? "Branch Updated Successfully!"
          : "Branch Created Successfully!",
        {
          description: editingId
            ? "Branch details have been updated."
            : "Redirecting to branch details...",
        }
      );
      reset();
      
      if (!editingId && result.data) {
        setCreatedBranch(result.data);
        setShowFundingModal(true);
      } else {
        onClose();
        router.refresh();
      }
    } catch (error) {
      toast.error("Something went wrong");
      setLoading(false);
      console.error(error);
    }
  }

  return (
    <>
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingId ? "Edit Branch" : "Add New Branch"}
          </DialogTitle>
          <DialogDescription>
            Fill in the branch information below. Fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <form className="" onSubmit={handleSubmit(saveBranch)}>
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium mb-4">Branch Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Branch Name *"
                  name="name"
                  icon={Building}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Location *"
                  name="location"
                  icon={MapPin}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-medium mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextInput
                  register={register}
                  errors={errors}
                  label="Contact Person"
                  name="contactPerson"
                  icon={User}
                />
                <TextInput
                  register={register}
                  errors={errors}
                  label="Contact Phone"
                  name="contactPhone"
                  type="tel"
                  icon={Phone}
                />
                <div className="md:col-span-2">
                  <TextInput
                    register={register}
                    errors={errors}
                    label="Email Address"
                    name="email"
                    type="email"
                    icon={Mail}
                  />
                </div>
              </div>
            </div>

            {/* Staff Assignments */}
            <div>
              <h3 className="text-lg font-medium mb-4">Staff Assignments</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accountant</Label>
                  <Select
                    defaultValue={initialData?.accountantId || ""}
                    onValueChange={(value) => setValue("accountantId", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Accountant" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountants?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch Manager</Label>
                  <Select
                    defaultValue={initialData?.managerId || ""}
                    onValueChange={(value) => setValue("managerId", value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  onClose();
                }}
              >
                Cancel
              </Button>
              <SubmitButton
                title={editingId ? "Update Branch" : "Create Branch"}
                loading={loading}
              />
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <InitialFundingModal
      isOpen={showFundingModal}
      onClose={() => {
        setShowFundingModal(false);
        onClose();
        router.refresh();
      }}
      branch={createdBranch}
    />
    </>
  );
}
