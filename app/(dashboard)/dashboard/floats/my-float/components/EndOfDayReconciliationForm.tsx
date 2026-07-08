// // app/dashboard/my-float/components/EndOfDayReconciliationForm.tsx
// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import {
//   Form,
//   FormControl,
//   FormDescription,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   AlertCircle,
//   CheckCircle2,
//   TrendingUp,
//   TrendingDown,
//   Loader2,
//   DollarSign,
//   ArrowRight,
// } from "lucide-react";
// import { submitEndOfDayReconciliation } from "@/actions/reconciliation";
// import {
//   Alert,
//   AlertDescription,
// } from "../../../reports/activity/component/Alert";

// const reconciliationSchema = z.object({
//   actualCashOnHand: z.coerce
//     .number({
//       required_error: "Cash on hand is required",
//       invalid_type_error: "Must be a valid number",
//     })
//     .min(0, "Cannot be negative"),
//   actualFloatAmount: z.coerce
//     .number({
//       required_error: "Float amount is required",
//       invalid_type_error: "Must be a valid number",
//     })
//     .min(0, "Cannot be negative"),
//   notes: z.string().optional(),
// });

// type ReconciliationFormData = z.infer<typeof reconciliationSchema>;

// interface EndOfDayReconciliationFormProps {
//   floatId: string;
//   userId: string;
//   expectedBalance: number;
//   openingBalance: number;
//   totalDeposits: number;
//   totalWithdrawals: number;
//   currentBalance: number;
//   onSuccess: () => void;
//   onClose: () => void;
// }

// export default function EndOfDayReconciliationForm({
//   floatId,
//   userId,
//   currentBalance,
//   openingBalance,
//   expectedBalance,
//   totalDeposits,
//   totalWithdrawals,
//   onClose,
//   onSuccess,
// }: EndOfDayReconciliationFormProps) {
//   const router = useRouter();
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [variance, setVariance] = useState(0);
//   const [varianceType, setVarianceType] = useState<
//     "balanced" | "overage" | "shortage"
//   >("balanced");

//   const form = useForm<ReconciliationFormData>({
//     resolver: zodResolver(reconciliationSchema),
//     defaultValues: {
//       actualCashOnHand: 0,
//       actualFloatAmount: 0,
//       notes: "",
//     },
//   });

//   const actualCashOnHand = form.watch("actualCashOnHand") || 0;
//   const actualFloatAmount = form.watch("actualFloatAmount") || 0;

//   useEffect(() => {
//     const totalPhysical = Number(actualCashOnHand) + Number(actualFloatAmount);
//     const calculatedVariance = totalPhysical - currentBalance;
//     setVariance(calculatedVariance);

//     const TOLERANCE = 1000;
//     if (Math.abs(calculatedVariance) <= TOLERANCE) {
//       setVarianceType("balanced");
//     } else if (calculatedVariance > TOLERANCE) {
//       setVarianceType("overage");
//     } else {
//       setVarianceType("shortage");
//     }
//   }, [actualCashOnHand, actualFloatAmount, currentBalance]);

//   const onSubmit = async (formData: ReconciliationFormData) => {
//     setIsSubmitting(true);

//     try {
//       const result = await submitEndOfDayReconciliation({
//         floatId,
//         actualCashOnHand: Number(formData.actualCashOnHand),
//         actualFloatAmount: Number(formData.actualFloatAmount),
//         reconciledByUserId: userId,
//         notes: formData.notes,
//       });

//       if (result.error) {
//         toast.error(result.error);
//         return;
//       }

//       if (result.success && result.data) {
//         const { variance, isBalanced, hasOverage, hasShortage } = result.data;

//         if (isBalanced) {
//           toast.success(`✅ Reconciliation Complete - Balanced!`, {
//             description: "Your float has been successfully reconciled.",
//           });
//         } else if (hasOverage) {
//           toast.warning(`⚠️ Reconciliation Complete - Overage Recorded`, {
//             description: `Overage: UGX ${Math.abs(variance).toLocaleString()} sent to suspense account`,
//           });
//         } else if (hasShortage) {
//           toast.error(`❌ Reconciliation Complete - Shortage Recorded`, {
//             description: `Shortage: UGX ${Math.abs(variance).toLocaleString()} has been recorded`,
//           });
//         }

//         onSuccess?.();
//         onClose();
//         router.refresh();
//       }
//     } catch (error) {
//       console.error("Reconciliation error:", error);
//       toast.error("Failed to submit reconciliation");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const totalPhysical = Number(actualCashOnHand) + Number(actualFloatAmount);

//   // Quick fill button to set total to current balance
//   const handleQuickFillBalance = () => {
//     const halfBalance = Math.floor(currentBalance / 2);
//     form.setValue("actualCashOnHand", halfBalance);
//     form.setValue("actualFloatAmount", currentBalance - halfBalance);
//     toast.info("Quick Fill Applied", {
//       description:
//         "Balance split equally between cash and float. Adjust as needed.",
//     });
//   };

//   return (
//     <Dialog open={true} onOpenChange={onClose}>
//       <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="text-2xl font-bold flex items-center gap-2">
//             <DollarSign className="h-6 w-6" />
//             End-of-Day Reconciliation
//           </DialogTitle>
//           <DialogDescription>
//             Count all physical money (cash + mobile money float) and submit for
//             processing.
//           </DialogDescription>
//         </DialogHeader>

//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//             {/* System Balance Info */}
//             <Card className="bg-blue-50 border-blue-200">
//               <CardHeader>
//                 <CardTitle className="text-base font-semibold text-blue-900">
//                   📊 Balance Information
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-2 gap-4">
//                   <div>
//                     <span className="text-sm text-gray-600">
//                       Opening Balance
//                     </span>
//                     <p className="text-xl font-bold text-blue-900">
//                       {formatCurrency(openingBalance)}
//                     </p>
//                   </div>
//                   <div>
//                     <span className="text-sm text-gray-600">
//                       Current System Balance
//                     </span>
//                     <p className="text-xl font-bold text-blue-900">
//                       {formatCurrency(currentBalance)}
//                     </p>
//                   </div>
//                 </div>

//                 {/* Quick Fill Button */}
//                 <div className="mt-4 pt-4 border-t border-blue-300">
//                   <Button
//                     type="button"
//                     onClick={handleQuickFillBalance}
//                     variant="outline"
//                     className="w-full bg-white hover:bg-blue-50"
//                   >
//                     <svg
//                       className="w-4 h-4 mr-2"
//                       fill="none"
//                       stroke="currentColor"
//                       viewBox="0 0 24 24"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2}
//                         d="M13 10V3L4 14h7v7l9-11h-7z"
//                       />
//                     </svg>
//                     Quick Fill - Use Full Balance (
//                     {formatCurrency(currentBalance)})
//                   </Button>
//                   <p className="text-xs text-gray-600 mt-2 text-center">
//                     Splits balance equally between cash and float. You can
//                     adjust the amounts after.
//                   </p>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Important Notice */}
//             <Alert className="bg-amber-50 border-amber-300">
//               <AlertCircle className="h-4 w-4 text-amber-600" />
//               <AlertDescription className="text-amber-800">
//                 <strong>Important:</strong> Count ALL physical money - both
//                 paper cash AND mobile money float. The system will compare your
//                 total against the current balance of{" "}
//                 {formatCurrency(currentBalance)}.
//               </AlertDescription>
//             </Alert>

//             {/* Physical Cash Entry */}
//             <Card>
//               <CardHeader>
//                 <CardTitle className="text-base font-semibold">
//                   💵 Physical Cash Count
//                 </CardTitle>
//               </CardHeader>
//               <CardContent className="space-y-4">
//                 {/* Cash on Hand */}
//                 <FormField
//                   control={form.control}
//                   name="actualCashOnHand"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel>Cash on Hand (Bills & Coins)</FormLabel>
//                       <FormControl>
//                         <Input
//                           type="number"
//                           step="1"
//                           min="0"
//                           max={currentBalance}
//                           placeholder="0"
//                           {...field}
//                           className="text-lg font-semibold"
//                         />
//                       </FormControl>
//                       <FormDescription>
//                         Count all physical cash currently in your possession
//                         (max: {formatCurrency(currentBalance)})
//                       </FormDescription>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />

//                 {/* Float Amount */}
//                 <FormField
//                   control={form.control}
//                   name="actualFloatAmount"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel>Mobile Money Float Balance</FormLabel>
//                       <FormControl>
//                         <Input
//                           type="number"
//                           step="1"
//                           min="0"
//                           max={currentBalance}
//                           placeholder="0"
//                           {...field}
//                           className="text-lg font-semibold"
//                         />
//                       </FormControl>
//                       <FormDescription>
//                         Your current mobile money float balance (max:{" "}
//                         {formatCurrency(currentBalance)})
//                       </FormDescription>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />

//                 {/* Total Display */}
//                 <div className="pt-3 border-t">
//                   <div className="flex justify-between items-center mb-2">
//                     <span className="font-medium text-gray-700">
//                       Total Physical Cash:
//                     </span>
//                     <span className="text-2xl font-bold text-blue-900">
//                       {formatCurrency(totalPhysical)}
//                     </span>
//                   </div>
//                   <div className="flex justify-between items-center text-sm text-gray-600">
//                     <span>Remaining to Account For:</span>
//                     <span
//                       className={`font-semibold ${totalPhysical > currentBalance ? "text-red-600" : "text-gray-900"}`}
//                     >
//                       {formatCurrency(Math.abs(currentBalance - totalPhysical))}
//                     </span>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>

//             {/* Variance Display */}
//             {totalPhysical > 0 && (
//               <Card
//                 className={`border-2 ${
//                   varianceType === "balanced"
//                     ? "bg-green-50 border-green-300"
//                     : varianceType === "overage"
//                       ? "bg-orange-50 border-orange-300"
//                       : "bg-red-50 border-red-300"
//                 }`}
//               >
//                 <CardContent className="pt-6">
//                   <div className="flex items-start gap-3">
//                     {varianceType === "balanced" && (
//                       <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
//                     )}
//                     {varianceType === "overage" && (
//                       <TrendingUp className="h-8 w-8 text-orange-600 flex-shrink-0" />
//                     )}
//                     {varianceType === "shortage" && (
//                       <TrendingDown className="h-8 w-8 text-red-600 flex-shrink-0" />
//                     )}

//                     <div className="flex-1">
//                       <h3 className="font-bold text-lg mb-3">
//                         {varianceType === "balanced" && "✅ Perfectly Balanced"}
//                         {varianceType === "overage" && "⚠️ Overage Detected"}
//                         {varianceType === "shortage" && "❌ Shortage Detected"}
//                       </h3>

//                       <div className="space-y-2 text-sm">
//                         <div className="flex justify-between">
//                           <span>Total Physical Cash:</span>
//                           <span className="font-bold">
//                             {formatCurrency(totalPhysical)}
//                           </span>
//                         </div>
//                         <div className="flex justify-between">
//                           <span>System Balance:</span>
//                           <span className="font-bold">
//                             {formatCurrency(currentBalance)}
//                           </span>
//                         </div>
//                         <div className="flex justify-between items-center pt-2 border-t">
//                           <span className="font-semibold">Variance:</span>
//                           <span
//                             className={`text-xl font-bold ${
//                               varianceType === "balanced"
//                                 ? "text-green-700"
//                                 : varianceType === "overage"
//                                   ? "text-orange-700"
//                                   : "text-red-700"
//                             }`}
//                           >
//                             {variance >= 0 ? "+" : ""}
//                             {formatCurrency(variance)}
//                           </span>
//                         </div>
//                       </div>

//                       {/* Explanation */}
//                       <Alert
//                         className={`mt-4 ${
//                           varianceType === "balanced"
//                             ? "bg-green-100 border-green-300"
//                             : varianceType === "overage"
//                               ? "bg-orange-100 border-orange-300"
//                               : "bg-red-100 border-red-300"
//                         }`}
//                       >
//                         <AlertDescription className="text-xs">
//                           {varianceType === "balanced" && (
//                             <p>
//                               Your cash count matches the system (within 1,000
//                               UGX tolerance). No discrepancy detected. You're
//                               reconciling the full balance of{" "}
//                               {formatCurrency(currentBalance)}.
//                             </p>
//                           )}
//                           {varianceType === "overage" && (
//                             <p>
//                               You have{" "}
//                               <strong>{formatCurrency(variance)} extra</strong>.
//                               This will be automatically transferred to the
//                               suspense account for investigation.
//                             </p>
//                           )}
//                           {varianceType === "shortage" && (
//                             <p>
//                               You're short by{" "}
//                               <strong>
//                                 {formatCurrency(Math.abs(variance))}
//                               </strong>
//                               . This shortage will be automatically recorded and
//                               flagged for investigation.
//                             </p>
//                           )}
//                         </AlertDescription>
//                       </Alert>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             )}

//             {/* Notes */}
//             <FormField
//               control={form.control}
//               name="notes"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Additional Notes (Optional)</FormLabel>
//                   <FormControl>
//                     <Textarea
//                       placeholder="Add any notes about discrepancies, issues, or special circumstances..."
//                       className="resize-none"
//                       rows={3}
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormDescription>
//                     Explain any variances or unusual circumstances
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Submit Section */}
//             <DialogFooter className="gap-2">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 disabled={isSubmitting}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={isSubmitting || totalPhysical === 0}
//                 className="min-w-[200px]"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Processing...
//                   </>
//                 ) : (
//                   <>
//                     Submit Reconciliation
//                     <ArrowRight className="ml-2 h-4 w-4" />
//                   </>
//                 )}
//               </Button>
//             </DialogFooter>
//           </form>
//         </Form>
//       </DialogContent>
//     </Dialog>
//   );
// }
// app/dashboard/my-float/components/EndOfDayReconciliationForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2,
  DollarSign,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
} from "../../../reports/activity/component/Alert";

const reconciliationSchema = z.object({
  actualCashOnHand: z.coerce
    .number({
      required_error: "Cash on hand is required",
      invalid_type_error: "Must be a valid number",
    })
    .min(0, "Cannot be negative"),
  actualFloatAmount: z.coerce
    .number({
      required_error: "Float amount is required",
      invalid_type_error: "Must be a valid number",
    })
    .min(0, "Cannot be negative"),
  notes: z.string().optional(),
});

type ReconciliationFormData = z.infer<typeof reconciliationSchema>;

interface EndOfDayReconciliationFormProps {
  floatId: string;
  userId: string;
  expectedBalance: number;
  openingBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  currentBalance: number;
  onSuccess: () => void;
  onClose: () => void;
}

export default function EndOfDayReconciliationForm({
  floatId,
  userId,
  currentBalance,
  openingBalance,
  expectedBalance,
  totalDeposits,
  totalWithdrawals,
  onClose,
  onSuccess,
}: EndOfDayReconciliationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [variance, setVariance] = useState(0);
  const [varianceType, setVarianceType] = useState<
    "balanced" | "overage" | "shortage"
  >("balanced");

  const form = useForm<ReconciliationFormData>({
    resolver: zodResolver(reconciliationSchema),
    defaultValues: {
      actualCashOnHand: 0,
      actualFloatAmount: 0,
      notes: "",
    },
  });

  const actualCashOnHand = form.watch("actualCashOnHand") || 0;
  const actualFloatAmount = form.watch("actualFloatAmount") || 0;

  useEffect(() => {
    const totalPhysical = Number(actualCashOnHand) + Number(actualFloatAmount);
    const calculatedVariance = totalPhysical - currentBalance;
    setVariance(calculatedVariance);

    const TOLERANCE = 1000;
    if (Math.abs(calculatedVariance) <= TOLERANCE) {
      setVarianceType("balanced");
    } else if (calculatedVariance > TOLERANCE) {
      setVarianceType("overage");
    } else {
      setVarianceType("shortage");
    }
  }, [actualCashOnHand, actualFloatAmount, currentBalance]);

  const onSubmit = async (formData: ReconciliationFormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/floats/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          floatId,
          actualCashOnHand: Number(formData.actualCashOnHand),
          actualFloatAmount: Number(formData.actualFloatAmount),
          notes: formData.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result.error);
        return;
      }

      if (result.success) {
        const { variance, isBalanced } = result.data;
        const hasOverage = variance > 1000;
        const hasShortage = variance < -1000;

        // ✅ Show success message indicating it's pending approval
        toast.success(`✅ Reconciliation Submitted!`, {
          description: `Your reconciliation is awaiting accountant approval. ${
            isBalanced
              ? "Amount is balanced."
              : hasOverage
                ? `Overage: UGX ${Math.abs(variance).toLocaleString()}`
                : `Shortage: UGX ${Math.abs(variance).toLocaleString()}`
          }`,
          duration: 5000,
        });

        onSuccess?.();
        onClose();
        router.refresh();
      }
    } catch (error) {
      console.error("Reconciliation error:", error);
      toast.error("Failed to submit reconciliation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPhysical = Number(actualCashOnHand) + Number(actualFloatAmount);

  // Quick fill button to set total to current balance
  const handleQuickFillBalance = () => {
    const halfBalance = Math.floor(currentBalance / 2);
    form.setValue("actualCashOnHand", halfBalance);
    form.setValue("actualFloatAmount", currentBalance - halfBalance);
    toast.info("Quick Fill Applied", {
      description:
        "Balance split equally between cash and float. Adjust as needed.",
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            End-of-Day Reconciliation
          </DialogTitle>
          <DialogDescription>
            Count all physical money and submit for accountant approval.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* System Balance Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-blue-900">
                  📊 Balance Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">
                      Opening Balance
                    </span>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(openingBalance)}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">
                      Current System Balance
                    </span>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(currentBalance)}
                    </p>
                  </div>
                </div>

                {/* Quick Fill Button */}
                <div className="mt-4 pt-4 border-t border-blue-300">
                  <Button
                    type="button"
                    onClick={handleQuickFillBalance}
                    variant="outline"
                    className="w-full bg-white hover:bg-blue-50"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Quick Fill - Use Full Balance (
                    {formatCurrency(currentBalance)})
                  </Button>
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    Splits balance equally between cash and float. You can
                    adjust after.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* ✅ Approval Notice */}
            <Alert className="bg-amber-50 border-amber-300">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Note:</strong> Your reconciliation will be sent to the
                accountant for approval. The accountant will receive your float
                money and update the vault accordingly.
              </AlertDescription>
            </Alert>

            {/* Physical Cash Entry */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  💵 Physical Cash Count
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cash on Hand */}
                <FormField
                  control={form.control}
                  name="actualCashOnHand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cash on Hand (Bills & Coins)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max={currentBalance}
                          placeholder="0"
                          {...field}
                          className="text-lg font-semibold"
                        />
                      </FormControl>
                      <FormDescription>
                        Count all physical cash (max:{" "}
                        {formatCurrency(currentBalance)})
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Float Amount */}
                <FormField
                  control={form.control}
                  name="actualFloatAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Money Float Balance</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max={currentBalance}
                          placeholder="0"
                          {...field}
                          className="text-lg font-semibold"
                        />
                      </FormControl>
                      <FormDescription>
                        Your current mobile money float (max:{" "}
                        {formatCurrency(currentBalance)})
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Total Display */}
                <div className="pt-3 border-t">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">
                      Total Physical Cash:
                    </span>
                    <span className="text-2xl font-bold text-blue-900">
                      {formatCurrency(totalPhysical)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Remaining to Account For:</span>
                    <span
                      className={`font-semibold ${totalPhysical > currentBalance ? "text-red-600" : "text-gray-900"}`}
                    >
                      {formatCurrency(Math.abs(currentBalance - totalPhysical))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variance Display */}
            {totalPhysical > 0 && (
              <Card
                className={`border-2 ${
                  varianceType === "balanced"
                    ? "bg-green-50 border-green-300"
                    : varianceType === "overage"
                      ? "bg-orange-50 border-orange-300"
                      : "bg-red-50 border-red-300"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    {varianceType === "balanced" && (
                      <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                    )}
                    {varianceType === "overage" && (
                      <TrendingUp className="h-8 w-8 text-orange-600 flex-shrink-0" />
                    )}
                    {varianceType === "shortage" && (
                      <TrendingDown className="h-8 w-8 text-red-600 flex-shrink-0" />
                    )}

                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-3">
                        {varianceType === "balanced" && "✅ Perfectly Balanced"}
                        {varianceType === "overage" && "⚠️ Overage Detected"}
                        {varianceType === "shortage" && "❌ Shortage Detected"}
                      </h3>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Total Physical Cash:</span>
                          <span className="font-bold">
                            {formatCurrency(totalPhysical)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>System Balance:</span>
                          <span className="font-bold">
                            {formatCurrency(currentBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="font-semibold">Variance:</span>
                          <span
                            className={`text-xl font-bold ${
                              varianceType === "balanced"
                                ? "text-green-700"
                                : varianceType === "overage"
                                  ? "text-orange-700"
                                  : "text-red-700"
                            }`}
                          >
                            {variance >= 0 ? "+" : ""}
                            {formatCurrency(variance)}
                          </span>
                        </div>
                      </div>

                      {/* Explanation */}
                      <Alert
                        className={`mt-4 ${
                          varianceType === "balanced"
                            ? "bg-green-100 border-green-300"
                            : varianceType === "overage"
                              ? "bg-orange-100 border-orange-300"
                              : "bg-red-100 border-red-300"
                        }`}
                      >
                        <AlertDescription className="text-xs">
                          {varianceType === "balanced" && (
                            <p>
                              ✅ Your cash count matches the system (within
                              1,000 UGX tolerance). Accountant will approve and
                              add {formatCurrency(currentBalance)} to vault.
                            </p>
                          )}
                          {varianceType === "overage" && (
                            <p>
                              ⚠️ You have{" "}
                              <strong>{formatCurrency(variance)} extra</strong>.
                              This will be sent to suspense account for
                              investigation upon approval.
                            </p>
                          )}
                          {varianceType === "shortage" && (
                            <p>
                              ❌ You're short by{" "}
                              <strong>
                                {formatCurrency(Math.abs(variance))}
                              </strong>
                              . This shortage will be recorded for investigation
                              upon approval.
                            </p>
                          )}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about discrepancies or special circumstances..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Explain any variances or unusual circumstances
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Section */}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || totalPhysical === 0}
                className="min-w-[200px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit for Approval
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
