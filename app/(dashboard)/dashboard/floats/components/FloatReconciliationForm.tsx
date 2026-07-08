// // @ts-nocheck
// // Update your FloatReconciliationCreateForm component to accept preSelectedFloatId
// "use client";
// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation"; // Ensure useRouter is imported

// interface FloatReconciliationCreateFormProps {
//   isOpen: boolean;
//   onClose: () => void;
//   currentUserId: string;
//   preSelectedFloatId?: string; // Add this prop
// }

// export default function FloatReconciliationCreateForm({
//   isOpen,
//   onClose,
//   currentUserId,
//   preSelectedFloatId, // Add this prop
// }: FloatReconciliationCreateFormProps) {
//   // In your useEffect or initial state setup:
//   useEffect(() => {
//     if (preSelectedFloatId && isOpen) {
//       // Pre-select the float when the form opens
//       setSelectedFloatId(preSelectedFloatId);
//       // You might also want to fetch the current balance for this float
//     }
//   }, [preSelectedFloatId, isOpen]);

//   // Rest of your existing form logic...
// }
// app/dashboard/floats/components/FloatReconciliationForm.tsx
// @ts-nocheck
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const reconciliationSchema = z.object({
  actualCashOnHand: z.coerce
    .number({ invalid_type_error: "Must be a valid number" })
    .min(0, "Amount cannot be negative"),
  floatToReturn: z.coerce
    .number({ invalid_type_error: "Must be a valid number" })
    .min(0, "Amount cannot be negative"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof reconciliationSchema>;

export default function ImprovedEODForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      actualCashOnHand: 0,
      floatToReturn: 0,
      notes: "",
    },
  });

  // Mock data for demo
  const systemBalance = 500000; // UGX 500,000

  // Watch form values
  const cashOnHand = Number(form.watch("actualCashOnHand")) || 0;
  const floatReturned = Number(form.watch("floatToReturn")) || 0;

  // Calculate totals
  const totalPhysicalCash = cashOnHand + floatReturned;
  const variance = totalPhysicalCash - systemBalance;
  const isBalanced = Math.abs(variance) <= 1000;

  // Categorize variance
  const hasOverage = variance > 1000;
  const hasShortage = variance < -1000;
  const suspenseAmount = hasOverage ? variance : 0;
  const shortageAmount = hasShortage ? Math.abs(variance) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    // Validate large variances
    if (Math.abs(variance) > 100000) {
      alert("Large variance detected. Please recount your cash.");
      setIsSubmitting(false);
      return;
    }

    // Require notes for significant variances
    if (Math.abs(variance) > 1000 && !values.notes?.trim()) {
      alert("Please provide an explanation for variances over UGX 1,000.");
      setIsSubmitting(false);
      return;
    }

    // Simulate API call
    setTimeout(() => {
      alert("Reconciliation submitted successfully!");
      setIsSubmitting(false);
      form.reset();
    }, 1000);
  };

  const getVarianceInfo = () => {
    if (isBalanced) {
      return {
        color: "text-green-600 bg-green-50 border-green-300",
        icon: "✓",
        title: "Balanced",
        message: "Your cash matches the system balance (within tolerance)",
      };
    } else if (hasOverage) {
      return {
        color: "text-orange-600 bg-orange-50 border-orange-300",
        icon: "↑",
        title: "Overage Detected",
        message: `Excess cash of ${formatCurrency(suspenseAmount)} will go to suspense account`,
      };
    } else {
      return {
        color: "text-red-600 bg-red-50 border-red-300",
        icon: "↓",
        title: "Shortage Detected",
        message: `Cash shortage of ${formatCurrency(shortageAmount)} must be explained`,
      };
    }
  };

  const varianceInfo = getVarianceInfo();

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg"></div>
  );
}
