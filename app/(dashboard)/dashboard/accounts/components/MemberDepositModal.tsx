"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DollarSign, Phone, CreditCard } from "lucide-react";
import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface MemberDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountNumber: string;
  ownerPhone?: string | null;
  memberId?: string | null;
  institutionId?: string | null;
}

export default function MemberDepositModal({
  isOpen,
  onClose,
  accountId,
  accountNumber,
  ownerPhone,
  memberId,
  institutionId,
}: MemberDepositModalProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      amount: "",
      mobileMoneyRef: ownerPhone || "",
    },
  });

  async function onSubmit(data: any) {
    try {
      setLoading(true);

      const formData = {
        accountId,
        memberId,
        institutionId,
        amount: Number(data.amount),
        channel: "MOBILE_MONEY",
        mobileMoneyRef: data.mobileMoneyRef,
        description: `Self-service deposit to ${accountNumber}`,
        depositType: "DIRECT",
      };

      const response = await fetch("/api/v1/deposits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to initiate deposit");
      }

      toast.success("Deposit Initiated!", {
        description: "Please check your phone for the mobile money prompt (STK Push).",
      });

      reset();
      onClose();
      router.refresh();
    } catch (error: any) {
      toast.error("Deposit Failed", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <CreditCard className="h-5 w-5" />
            Deposit via Mobile Money
          </DialogTitle>
          <DialogDescription>
            Account: <span className="font-semibold text-gray-900">{accountNumber}</span>
            <br />
            Funds will be added to your account once you confirm the payment on your phone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <TextInput
            register={register}
            errors={errors}
            label="Amount (UGX) *"
            name="amount"
            type="number"
            icon={DollarSign}
            placeholder="Enter amount"
          />

          <TextInput
            register={register}
            errors={errors}
            label="Mobile Money Number *"
            name="mobileMoneyRef"
            type="text"
            icon={Phone}
            placeholder="e.g. 256700000000"
          />

          <div className="pt-4">
            <SubmitButton
              loading={loading}
              title="Initiate Deposit"
              loadingTitle="Processing..."
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
