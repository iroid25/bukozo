"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";

interface AccountFeeSettingsDialogProps {
  accountId: string;
  accountNumber: string;
  accountTypeName: string;
  currentFlatFee: number | null;
  currentPercentage: number | null;
  defaultFlatFee: number | null;
  defaultPercentage: number | null;
}

export default function AccountFeeSettingsDialog({
  accountId,
  accountNumber,
  accountTypeName,
  currentFlatFee,
  currentPercentage,
  defaultFlatFee,
  defaultPercentage,
}: AccountFeeSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      customFlatWithdrawalFee: currentFlatFee,
      customWithdrawalFeePercentage: currentPercentage,
    },
  });

  // Watch values to handle null/empty logic if needed
  const flatFee = watch("customFlatWithdrawalFee");
  const pctFee = watch("customWithdrawalFeePercentage");

  async function onSubmit(data: any) {
    setLoading(true);
    try {
      // Convert to number or null (if empty string/undefined)
      const flat =
        data.customFlatWithdrawalFee === "" ||
        data.customFlatWithdrawalFee === null ||
        data.customFlatWithdrawalFee === undefined
          ? null
          : Number(data.customFlatWithdrawalFee);
          
      const pct =
        data.customWithdrawalFeePercentage === "" ||
        data.customWithdrawalFeePercentage === null ||
        data.customWithdrawalFeePercentage === undefined
          ? null
          : Number(data.customWithdrawalFeePercentage);

      const response = await fetch(`/api/v1/accounts/${encodeURIComponent(accountId)}/fees`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customFlatWithdrawalFee: flat,
          customWithdrawalFeePercentage: pct,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json?.error || "Failed to update account fees");
      } else {
        toast.success("Account fees updated successfully");
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Fee Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fee Settings</DialogTitle>
          <DialogDescription>
            Customize withdrawal fees for Account <strong>{accountNumber}</strong>.
            Leave fields empty to use the defaults from <strong>{accountTypeName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-500">
              Default {accountTypeName} Fees
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              <div>
                <span className="block font-semibold">Flat Fee:</span>
                {defaultFlatFee != null
                  ? `UGX ${defaultFlatFee.toLocaleString()}`
                  : "None"}
              </div>
              <div>
                <span className="block font-semibold">Percentage:</span>
                {defaultPercentage != null ? `${defaultPercentage}%` : "None"}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <TextInput
              label="Custom Flat Fee (UGX)"
              name="customFlatWithdrawalFee"
              register={register}
              errors={errors}
              type="number"
              placeholder="Leave empty to use default"
            />

            <TextInput
              label="Custom Percentage (%)"
              name="customWithdrawalFeePercentage"
              register={register}
              errors={errors}
              type="number"
              step="0.01"
              placeholder="Leave empty to use default"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton
              title="Save Changes"
              loading={loading}
              loadingTitle="Saving..."
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
