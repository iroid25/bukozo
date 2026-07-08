// FILE: app/dashboard/insurance/record-payment/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shield, DollarSign, ArrowLeft, Save } from "lucide-react";
import { useSession } from "next-auth/react";

export default function RecordInsurancePaymentPage() {
  const router = useRouter();
  const { status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    reference: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (status !== "authenticated") {
      toast.error("User not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/insurance/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          description: formData.description,
          reference: formData.reference || undefined,
        }),
      });
      const result = await response.json();

      if (response.ok && result.success) {
        toast.success("Insurance payment recorded successfully");
        router.push("/dashboard/insurance");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to record payment");
      }
    } catch (error) {
      toast.error("An error occurred while recording payment");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Insurance
        </Button>
        <h1 className="text-3xl font-bold">Record Insurance Payment</h1>
        <p className="text-gray-500 mt-2">
          Record payments made to the insurance company
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Enter amount"
                  className="pl-10"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Amount to be paid to insurance company
              </p>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference (Optional)</Label>
              <Input
                id="reference"
                type="text"
                placeholder="e.g., Transaction ID, Cheque Number, Bank Transfer Ref"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                Any reference number from the payment
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="e.g., Monthly insurance premium payment for November 2024 via Bank Transfer"
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
              <p className="text-xs text-gray-500">
                Provide details about this payment including payment method
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || status !== "authenticated"}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Record Payment
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">
                About Insurance Payments
              </h3>
              <p className="text-sm text-blue-800">
                This form is used to record payments made from the SACCO
                Insurance Account to the insurance company. The amount will be
                deducted from the insurance pool and recorded as a payment out.
              </p>
              <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                <li>
                  Ensure the insurance account has sufficient balance before
                  recording
                </li>
                <li>
                  Always include a clear description with payment method details
                </li>
                <li>Include payment reference for bank transfers or cheques</li>
                <li>This action cannot be undone, verify all details first</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
