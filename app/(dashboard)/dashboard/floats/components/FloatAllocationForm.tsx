// // @ts-nocheck
// "use client";
// import { useState, useEffect, useMemo } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import * as z from "zod";

// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   Loader2,
//   DollarSign,
//   User,
//   Building,
//   AlertCircle,
//   Wallet,
// } from "lucide-react";
// import { Alert, AlertDescription } from "@/components/ui/alert";

// // Server action import

// const floatAllocationSchema = z.object({
//   tellerAgentId: z.string().min(1, "Please select a teller/agent"),
//   branchId: z.string().min(1, "Please select a branch"),
//   amount: z.coerce
//     .number()
//     .min(1000, "Minimum allocation is UGX 1,000")
//     .max(100000000, "Maximum allocation is UGX 100,000,000"),
//   notes: z.string().optional(),
// });

// type FloatAllocationFormData = z.infer<typeof floatAllocationSchema>;

// interface EligibleUser {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   phone?: string | null;
//   branchId?: string | null;
//   branch?: { id: string; name: string; location?: string } | null;
//   floatStatus: {
//     balance: number;
//     isActiveForDay: boolean;
//     canStartNewDay: boolean;
//     pendingReconciliation: boolean;
//     lastReconciliation?: Date | null;
//   };
// }

// interface Branch {
//   id: string;
//   name: string;
//   location?: string;
// }

// interface FloatAllocationCreateFormProps {
//   isOpen: boolean;
//   onClose: () => void;
//   currentUserId: string;
//   eligibleUsers: EligibleUser[];
//   branches: Branch[];
//   totalBalance: number;
// }

// export default function FloatAllocationCreateForm({
//   isOpen,
//   onClose,
//   currentUserId,
//   eligibleUsers,
//   branches,
//   totalBalance,
// }: FloatAllocationCreateFormProps) {
//   const router = useRouter();
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [selectedUser, setSelectedUser] = useState<EligibleUser | null>(null);
//   const [vaultBalance, setVaultBalance] = useState<number>(0);
//   const [isLoadingVault, setIsLoadingVault] = useState(true);

//   // âœ… Filter out tellers with pending reconciliations
//   const availableTellers = useMemo(() => {
//     return eligibleUsers.filter(
//       (user) => !user.floatStatus.pendingReconciliation
//     );
//   }, [eligibleUsers]);

//   const form = useForm<FloatAllocationFormData>({
//     resolver: zodResolver(floatAllocationSchema),
//     defaultValues: {
//       tellerAgentId: "",
//       branchId: "",
//       amount: 0,
//       notes: "",
//     },
//   });

//   // âœ… Fetch accountant's vault balance
//   useEffect(() => {
//     async function fetchVaultBalance() {
//       try {
//         setIsLoadingVault(true);
//         const response = await fetch("/api/vault/balance");
//         if (response.ok) {
//           const data = await response.json();
//           setVaultBalance(data.balance || 0);
//         }
//       } catch (error) {
//         console.error("Error fetching vault balance:", error);
//         toast.error("Could not fetch vault balance");
//       } finally {
//         setIsLoadingVault(false);
//       }
//     }

//     if (isOpen) {
//       fetchVaultBalance();
//     }
//   }, [isOpen]);

//   const formatCurrency = (amount: number) =>
//     new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);

//   // Watch for teller selection
//   useEffect(() => {
//     const subscription = form.watch((value, { name }) => {
//       if (name === "tellerAgentId" && value.tellerAgentId) {
//         const user = availableTellers.find((u) => u.id === value.tellerAgentId);
//         setSelectedUser(user || null);

//         // Auto-fill branch if user has one
//         if (user?.branchId) {
//           form.setValue("branchId", user.branchId);
//         }
//       }
//     });
//     return () => subscription.unsubscribe();
//   }, [form, availableTellers]);

//   const onSubmit = async (data: FloatAllocationFormData) => {
//     try {
//       setIsSubmitting(true);

//       // âœ… Validate vault has enough balance
//       if (data.amount > vaultBalance) {
//         toast.error("Insufficient vault balance", {
//           description: `Your vault balance (${formatCurrency(vaultBalance)}) is less than the allocation amount (${formatCurrency(data.amount)})`,
//         });
//         return;
//       }

//       // Call the server action with vault deduction
//       const result = await allocateFloatWithVaultDeduction({
//         tellerAgentId: data.tellerAgentId,
//         branchId: data.branchId,
//         amount: data.amount,
//         allocatedByUserId: currentUserId,
//         notes: data.notes,
//       });

//       if (result.error) {
//         toast.error("Allocation failed", {
//           description: result.error,
//         });
//         return;
//       }

//       toast.success("Float allocated successfully!", {
//         description: `${formatCurrency(data.amount)} allocated to ${selectedUser?.name}. Vault balance reduced.`,
//       });

//       form.reset();
//       setSelectedUser(null);
//       router.refresh();
//       onClose();
//     } catch (error) {
//       console.error("Error allocating float:", error);
//       toast.error("Allocation failed ", {
//         description:
//           error instanceof Error ? error.message : "Unknown error occurred",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const watchedAmount = form.watch("amount");
//   const remainingVaultBalance = vaultBalance - (watchedAmount || 0);

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Allocate Float to Teller/Agent</DialogTitle>
//           <DialogDescription>
//             Allocate float from your vault to a teller or agent. Amount will be
//             deducted from your vault.
//           </DialogDescription>
//         </DialogHeader>

//         {/* âœ… Vault Balance Display */}
//         <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
//           <CardContent className="pt-6">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center gap-3">
//                 <div className="p-3 bg-blue-100 rounded-full">
//                   <Wallet className="h-6 w-6 text-blue-600" />
//                 </div>
//                 <div>
//                   <p className="text-sm text-gray-600 font-medium">
//                     Your Vault Balance
//                   </p>
//                   {isLoadingVault ? (
//                     <div className="flex items-center gap-2 mt-1">
//                       <Loader2 className="h-4 w-4 animate-spin" />
//                       <span className="text-sm text-gray-500">Loading...</span>
//                     </div>
//                   ) : (
//                     <p className="text-2xl font-bold text-blue-700">
//                       {formatCurrency(vaultBalance)}
//                     </p>
//                   )}
//                 </div>
//               </div>

//               {watchedAmount > 0 && (
//                 <div className="text-right">
//                   <p className="text-sm text-gray-600">After Allocation</p>
//                   <p
//                     className={`text-xl font-bold ${
//                       remainingVaultBalance < 0
//                         ? "text-red-600"
//                         : "text-green-600"
//                     }`}
//                   >
//                     {formatCurrency(remainingVaultBalance)}
//                   </p>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* âœ… Warning if no tellers available */}
//         {availableTellers.length === 0 && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               No tellers available for allocation. All tellers have pending
//               reconciliations.
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* âœ… Warning if insufficient vault balance */}
//         {vaultBalance === 0 && !isLoadingVault && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               Your vault balance is zero. Please add funds to your vault before
//               allocating float.
//             </AlertDescription>
//           </Alert>
//         )}

//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//             {/* Teller Selection */}
//             <FormField
//               control={form.control}
//               name="tellerAgentId"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Select Teller/Agent *</FormLabel>
//                   <Select
//                     onValueChange={field.onChange}
//                     value={field.value}
//                     disabled={isSubmitting || availableTellers.length === 0}
//                   >
//                     <FormControl>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Choose a teller or agent" />
//                       </SelectTrigger>
//                     </FormControl>
//                     <SelectContent>
//                       {availableTellers.map((user) => (
//                         <SelectItem key={user.id} value={user.id}>
//                           <div className="flex items-center gap-2">
//                             <User className="h-4 w-4" />
//                             <div>
//                               <div className="font-medium">{user.name}</div>
//                               <div className="text-xs text-gray-500">
//                                 {user.email} â€¢ {user.role} â€¢ Balance:{" "}
//                                 {formatCurrency(user.floatStatus.balance)}
//                               </div>
//                             </div>
//                           </div>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Branch Selection */}
//             <FormField
//               control={form.control}
//               name="branchId"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Branch *</FormLabel>
//                   <Select
//                     onValueChange={field.onChange}
//                     value={field.value}
//                     disabled={isSubmitting}
//                   >
//                     <FormControl>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select branch" />
//                       </SelectTrigger>
//                     </FormControl>
//                     <SelectContent>
//                       {branches.map((branch) => (
//                         <SelectItem key={branch.id} value={branch.id}>
//                           <div className="flex items-center gap-2">
//                             <Building className="h-4 w-4" />
//                             <div>
//                               <div className="font-medium">{branch.name}</div>
//                               {branch.location && (
//                                 <div className="text-xs text-gray-500">
//                                   {branch.location}
//                                 </div>
//                               )}
//                             </div>
//                           </div>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Amount */}
//             <FormField
//               control={form.control}
//               name="amount"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Allocation Amount (UGX) *</FormLabel>
//                   <FormControl>
//                     <div className="relative">
//                       <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                       <Input
//                         type="number"
//                         placeholder="Enter amount"
//                         className="pl-10"
//                         disabled={isSubmitting}
//                         {...field}
//                       />
//                     </div>
//                   </FormControl>
//                   {watchedAmount > 0 && (
//                     <p className="text-sm text-gray-600 mt-1">
//                       Formatted: {formatCurrency(watchedAmount)}
//                     </p>
//                   )}
//                   {watchedAmount > vaultBalance && (
//                     <p className="text-sm text-red-600 mt-1">
//                       âš ï¸ Amount exceeds vault balance
//                     </p>
//                   )}
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Notes */}
//             <FormField
//               control={form.control}
//               name="notes"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Notes (Optional)</FormLabel>
//                   <FormControl>
//                     <Input
//                       placeholder="Add any additional notes"
//                       disabled={isSubmitting}
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Selected User Summary */}
//             {selectedUser && (
//               <Card className="bg-gray-50">
//                 <CardContent className="pt-6">
//                   <h3 className="font-semibold mb-3 flex items-center gap-2">
//                     <User className="h-4 w-4" />
//                     Selected Teller Summary
//                   </h3>
//                   <div className="grid grid-cols-2 gap-4 text-sm">
//                     <div>
//                       <span className="text-gray-600">Name:</span>
//                       <p className="font-medium">{selectedUser.name}</p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">Role:</span>
//                       <p className="font-medium">
//                         <Badge>{selectedUser.role}</Badge>
//                       </p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">Current Balance:</span>
//                       <p className="font-medium text-blue-600">
//                         {formatCurrency(selectedUser.floatStatus.balance)}
//                       </p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">New Balance:</span>
//                       <p className="font-medium text-green-600">
//                         {formatCurrency(
//                           selectedUser.floatStatus.balance +
//                             (watchedAmount || 0)
//                         )}
//                       </p>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             )}

//             {/* Action Buttons */}
//             <div className="flex gap-3 pt-4">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 disabled={isSubmitting}
//                 className="flex-1"
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={
//                   isSubmitting ||
//                   availableTellers.length === 0 ||
//                   vaultBalance === 0 ||
//                   watchedAmount > vaultBalance ||
//                   isLoadingVault
//                 }
//                 className="flex-1"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Allocating...
//                   </>
//                 ) : (
//                   <>
//                     <DollarSign className="mr-2 h-4 w-4" />
//                     Allocate Float
//                   </>
//                 )}
//               </Button>
//             </div>
//           </form>
//         </Form>
//       </DialogContent>
//     </Dialog>
//   );
// }
// // @ts-nocheck
// "use client";
// import { useState, useEffect, useMemo } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import * as z from "zod";

// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   Loader2,
//   DollarSign,
//   User,
//   Building,
//   AlertCircle,
//   Wallet,
//   CheckCircle2,
//   XCircle,
//   Info,
// } from "lucide-react";
// import { Alert, AlertDescription } from "@/components/ui/alert";

// // Server action import

// const floatAllocationSchema = z.object({
//   tellerAgentId: z.string().min(1, "Please select a teller/agent"),
//   branchId: z.string().min(1, "Please select a branch"),
//   amount: z.coerce
//     .number()
//     .min(1000, "Minimum allocation is UGX 1,000")
//     .max(100000000, "Maximum allocation is UGX 100,000,000"),
//   notes: z.string().optional(),
// });

// type FloatAllocationFormData = z.infer<typeof floatAllocationSchema>;

// interface EligibleUser {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   phone?: string | null;
//   branchId?: string | null;
//   branch?: { id: string; name: string; location?: string } | null;
//   floatStatus: {
//     balance: number;
//     isActiveForDay: boolean;
//     canStartNewDay: boolean;
//     pendingReconciliation: boolean;
//     lastReconciliation?: Date | null;
//   } | null;
//   isEligible: boolean;
//   ineligibleReason?: string;
// }

// interface Branch {
//   id: string;
//   name: string;
//   location?: string;
// }

// interface FloatAllocationCreateFormProps {
//   isOpen: boolean;
//   onClose: () => void;
//   currentUserId: string;
//   eligibleUsers: EligibleUser[];
//   branches: Branch[];
//   totalBalance: number;
// }

// export default function FloatAllocationCreateForm({
//   isOpen,
//   onClose,
//   currentUserId,
//   eligibleUsers,
//   branches,
//   totalBalance,
// }: FloatAllocationCreateFormProps) {
//   const router = useRouter();
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [selectedUser, setSelectedUser] = useState<EligibleUser | null>(null);
//   const [vaultBalance, setVaultBalance] = useState<number>(0);
//   const [isLoadingVault, setIsLoadingVault] = useState(true);

//   // Show ALL tellers from the eligibleUsers prop
//   const allTellers = useMemo(() => {
//     return eligibleUsers;
//   }, [eligibleUsers]);

//   // Count eligible vs ineligible
//   const eligibleCount = useMemo(() => {
//     return allTellers.filter((u) => u.isEligible).length;
//   }, [allTellers]);

//   const ineligibleCount = useMemo(() => {
//     return allTellers.filter((u) => !u.isEligible).length;
//   }, [allTellers]);

//   const form = useForm<FloatAllocationFormData>({
//     resolver: zodResolver(floatAllocationSchema),
//     defaultValues: {
//       tellerAgentId: "",
//       branchId: "",
//       amount: 0,
//       notes: "",
//     },
//   });

//   // Fetch accountant's vault balance
//   useEffect(() => {
//     async function fetchVaultBalance() {
//       try {
//         setIsLoadingVault(true);
//         const response = await fetch("/api/vault/balance");
//         if (response.ok) {
//           const data = await response.json();
//           setVaultBalance(data.balance || 0);
//         }
//       } catch (error) {
//         console.error("Error fetching vault balance:", error);
//         toast.error("Could not fetch vault balance");
//       } finally {
//         setIsLoadingVault(false);
//       }
//     }

//     if (isOpen) {
//       fetchVaultBalance();
//     }
//   }, [isOpen]);

//   const formatCurrency = (amount: number) =>
//     new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);

//   // Watch for teller selection
//   useEffect(() => {
//     const subscription = form.watch((value, { name }) => {
//       if (name === "tellerAgentId" && value.tellerAgentId) {
//         const user = allTellers.find((u) => u.id === value.tellerAgentId);
//         setSelectedUser(user || null);

//         // Auto-fill branch if user has one
//         if (user?.branchId) {
//           form.setValue("branchId", user.branchId);
//         }
//       }
//     });
//     return () => subscription.unsubscribe();
//   }, [form, allTellers]);

//   const onSubmit = async (data: FloatAllocationFormData) => {
//     try {
//       setIsSubmitting(true);

//       // Check if selected user is eligible
//       if (selectedUser && !selectedUser.isEligible) {
//         toast.error("Cannot allocate float", {
//           description: `This teller is ineligible: ${selectedUser.ineligibleReason}`,
//         });
//         return;
//       }

//       // Validate vault has enough balance
//       if (data.amount > vaultBalance) {
//         toast.error("Insufficient vault balance", {
//           description: `Your vault balance (${formatCurrency(vaultBalance)}) is less than the allocation amount (${formatCurrency(data.amount)})`,
//         });
//         return;
//       }

//       // Call the server action with vault deduction
//       const result = await allocateFloatWithVaultDeduction({
//         tellerAgentId: data.tellerAgentId,
//         branchId: data.branchId,
//         amount: data.amount,
//         allocatedByUserId: currentUserId,
//         notes: data.notes,
//       });

//       if (result.error) {
//         toast.error("Allocation failed", {
//           description: result.error,
//         });
//         return;
//       }

//       toast.success("Float allocated successfully!", {
//         description: `${formatCurrency(data.amount)} allocated to ${selectedUser?.name}. Vault balance reduced.`,
//       });

//       form.reset();
//       setSelectedUser(null);
//       router.refresh();
//       onClose();
//     } catch (error) {
//       console.error("Error allocating float:", error);
//       toast.error("Allocation failed", {
//         description:
//           error instanceof Error ? error.message : "Unknown error occurred",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const watchedAmount = form.watch("amount");
//   const remainingVaultBalance = vaultBalance - (watchedAmount || 0);
//   const canAllocate =
//     selectedUser?.isEligible &&
//     watchedAmount > 0 &&
//     watchedAmount <= vaultBalance &&
//     !isLoadingVault;

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle>Allocate Float to Teller/Agent</DialogTitle>
//           <DialogDescription>
//             Select any teller from the list and allocate float from your vault.
//             Only tellers with 0 balance (who have completed reconciliation) can
//             receive new float allocations.
//           </DialogDescription>
//         </DialogHeader>

//         {/* Vault Balance Display */}
//         <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
//           <CardContent className="pt-6">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center gap-3">
//                 <div className="p-3 bg-blue-100 rounded-full">
//                   <Wallet className="h-6 w-6 text-blue-600" />
//                 </div>
//                 <div>
//                   <p className="text-sm text-gray-600 font-medium">
//                     Your Vault Balance
//                   </p>
//                   {isLoadingVault ? (
//                     <div className="flex items-center gap-2 mt-1">
//                       <Loader2 className="h-4 w-4 animate-spin" />
//                       <span className="text-sm text-gray-500">Loading...</span>
//                     </div>
//                   ) : (
//                     <p className="text-2xl font-bold text-blue-700">
//                       {formatCurrency(vaultBalance)}
//                     </p>
//                   )}
//                 </div>
//               </div>

//               {watchedAmount > 0 && (
//                 <div className="text-right">
//                   <p className="text-sm text-gray-600">After Allocation</p>
//                   <p
//                     className={`text-xl font-bold ${
//                       remainingVaultBalance < 0
//                         ? "text-red-600"
//                         : "text-green-600"
//                     }`}
//                   >
//                     {formatCurrency(remainingVaultBalance)}
//                   </p>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Teller Status Info */}
//         {allTellers.length > 0 && (
//           <Alert>
//             <Info className="h-4 w-4" />
//             <AlertDescription>
//               <div className="space-y-1">
//                 <div className="flex items-center justify-between">
//                   <div>
//                     <strong>All Tellers:</strong> {allTellers.length} total
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-4 text-sm">
//                   <span className="flex items-center gap-1 text-green-600">
//                     <CheckCircle2 className="h-3 w-3" />
//                     {eligibleCount} eligible (0 balance)
//                   </span>
//                   {ineligibleCount > 0 && (
//                     <span className="flex items-center gap-1 text-red-600">
//                       <XCircle className="h-3 w-3" />
//                       {ineligibleCount} ineligible (pending reconciliation)
//                     </span>
//                   )}
//                 </div>
//               </div>
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* No tellers warning */}
//         {allTellers.length === 0 && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               <strong>No tellers found.</strong>
//               <br />
//               Please ensure there are active tellers in your system.
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* Insufficient vault balance warning */}
//         {vaultBalance === 0 && !isLoadingVault && (
//           <Alert variant="destructive">
//             <AlertCircle className="h-4 w-4" />
//             <AlertDescription>
//               Your vault balance is zero. Please add funds to your vault before
//               allocating float.
//             </AlertDescription>
//           </Alert>
//         )}

//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//             {/* Teller Selection - Shows ALL tellers */}
//             <FormField
//               control={form.control}
//               name="tellerAgentId"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Select Teller/Agent *</FormLabel>
//                   <Select
//                     onValueChange={field.onChange}
//                     value={field.value}
//                     disabled={isSubmitting || allTellers.length === 0}
//                   >
//                     <FormControl>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Choose a teller or agent" />
//                       </SelectTrigger>
//                     </FormControl>
//                     <SelectContent className="max-h-[400px]">
//                       {/* Eligible Tellers Section */}
//                       {eligibleCount > 0 && (
//                         <>
//                           <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50 sticky top-0 z-10">
//                             âœ“ ELIGIBLE FOR ALLOCATION ({eligibleCount})
//                           </div>
//                           {allTellers
//                             .filter((user) => user.isEligible)
//                             .map((user) => (
//                               <SelectItem key={user.id} value={user.id}>
//                                 <div className="flex items-center gap-2 py-1">
//                                   <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
//                                   <div className="flex-1 min-w-0">
//                                     <div className="font-medium truncate">
//                                       {user.name}
//                                     </div>
//                                     <div className="text-xs text-gray-500 truncate">
//                                       {user.email} â€¢ {user.role}
//                                     </div>
//                                     <div className="text-xs text-green-600 font-medium">
//                                       {user.floatStatus ? (
//                                         <>
//                                           Balance: UGX 0 âœ“ Ready for allocation
//                                         </>
//                                       ) : (
//                                         <>New User â€¢ No float history</>
//                                       )}
//                                     </div>
//                                   </div>
//                                 </div>
//                               </SelectItem>
//                             ))}
//                         </>
//                       )}

//                       {/* Ineligible Tellers Section */}
//                       {ineligibleCount > 0 && (
//                         <>
//                           <div className="px-2 py-1.5 text-xs font-semibold text-red-700 bg-red-50 sticky top-0 z-10 mt-1">
//                             âœ— CANNOT RECEIVE FLOAT ({ineligibleCount})
//                           </div>
//                           {allTellers
//                             .filter((user) => !user.isEligible)
//                             .map((user) => (
//                               <SelectItem
//                                 key={user.id}
//                                 value={user.id}
//                                 disabled
//                               >
//                                 <div className="flex items-center gap-2 py-1 opacity-60">
//                                   <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
//                                   <div className="flex-1 min-w-0">
//                                     <div className="font-medium truncate">
//                                       {user.name}
//                                     </div>
//                                     <div className="text-xs text-gray-500 truncate">
//                                       {user.email} â€¢ {user.role}
//                                     </div>
//                                     {user.floatStatus && (
//                                       <div className="text-xs text-gray-600">
//                                         Balance:{" "}
//                                         {formatCurrency(
//                                           user.floatStatus.balance
//                                         )}
//                                       </div>
//                                     )}
//                                     <div className="text-xs text-red-600 font-medium truncate">
//                                       âš ï¸ {user.ineligibleReason}
//                                     </div>
//                                   </div>
//                                 </div>
//                               </SelectItem>
//                             ))}
//                         </>
//                       )}
//                     </SelectContent>
//                   </Select>
//                   <FormMessage />
//                   <p className="text-xs text-gray-500 mt-1">
//                     Showing all {allTellers.length} teller
//                     {allTellers.length !== 1 ? "s" : ""} in the system.
//                     {eligibleCount > 0 && (
//                       <span className="text-green-600 ml-1">
//                         {eligibleCount} can receive float now.
//                       </span>
//                     )}
//                   </p>
//                 </FormItem>
//               )}
//             />

//             {/* Branch Selection */}
//             <FormField
//               control={form.control}
//               name="branchId"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Branch *</FormLabel>
//                   <Select
//                     onValueChange={field.onChange}
//                     value={field.value}
//                     disabled={isSubmitting}
//                   >
//                     <FormControl>
//                       <SelectTrigger>
//                         <SelectValue placeholder="Select branch" />
//                       </SelectTrigger>
//                     </FormControl>
//                     <SelectContent>
//                       {branches.map((branch) => (
//                         <SelectItem key={branch.id} value={branch.id}>
//                           <div className="flex items-center gap-2">
//                             <Building className="h-4 w-4" />
//                             <div>
//                               <div className="font-medium">{branch.name}</div>
//                               {branch.location && (
//                                 <div className="text-xs text-gray-500">
//                                   {branch.location}
//                                 </div>
//                               )}
//                             </div>
//                           </div>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Amount */}
//             <FormField
//               control={form.control}
//               name="amount"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Allocation Amount (UGX) *</FormLabel>
//                   <FormControl>
//                     <div className="relative">
//                       <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
//                       <Input
//                         type="number"
//                         placeholder="Enter amount (min: 1,000)"
//                         className="pl-10"
//                         disabled={isSubmitting}
//                         {...field}
//                       />
//                     </div>
//                   </FormControl>
//                   {watchedAmount > 0 && (
//                     <p className="text-sm text-gray-600 mt-1">
//                       Formatted: {formatCurrency(watchedAmount)}
//                     </p>
//                   )}
//                   {watchedAmount > vaultBalance && (
//                     <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
//                       <AlertCircle className="h-3 w-3" />
//                       Amount exceeds your vault balance
//                     </p>
//                   )}
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Notes */}
//             <FormField
//               control={form.control}
//               name="notes"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Notes (Optional)</FormLabel>
//                   <FormControl>
//                     <Input
//                       placeholder="Add any additional notes or reference"
//                       disabled={isSubmitting}
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Selected User Summary */}
//             {selectedUser && (
//               <Card
//                 className={
//                   selectedUser.isEligible
//                     ? "bg-green-50 border-green-200"
//                     : "bg-red-50 border-red-200"
//                 }
//               >
//                 <CardContent className="pt-6">
//                   <h3 className="font-semibold mb-3 flex items-center gap-2">
//                     {selectedUser.isEligible ? (
//                       <>
//                         <CheckCircle2 className="h-4 w-4 text-green-600" />
//                         Selected Teller Summary
//                       </>
//                     ) : (
//                       <>
//                         <XCircle className="h-4 w-4 text-red-600" />
//                         Ineligible Teller Selected
//                       </>
//                     )}
//                   </h3>
//                   <div className="grid grid-cols-2 gap-4 text-sm">
//                     <div>
//                       <span className="text-gray-600">Name:</span>
//                       <p className="font-medium">{selectedUser.name}</p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">Role:</span>
//                       <p className="font-medium">
//                         <Badge
//                           variant={
//                             selectedUser.isEligible ? "default" : "destructive"
//                           }
//                         >
//                           {selectedUser.role}
//                         </Badge>
//                       </p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">Current Balance:</span>
//                       <p
//                         className={`font-medium ${selectedUser.isEligible ? "text-green-600" : "text-red-600"}`}
//                       >
//                         {selectedUser.floatStatus
//                           ? formatCurrency(selectedUser.floatStatus.balance)
//                           : "No float history"}
//                         {selectedUser.isEligible && " âœ“"}
//                       </p>
//                     </div>
//                     <div>
//                       <span className="text-gray-600">After Allocation:</span>
//                       <p className="font-medium text-blue-600">
//                         {formatCurrency(
//                           (selectedUser.floatStatus?.balance || 0) +
//                             (watchedAmount || 0)
//                         )}
//                       </p>
//                     </div>
//                     {!selectedUser.isEligible &&
//                       selectedUser.ineligibleReason && (
//                         <div className="col-span-2">
//                           <Alert variant="destructive" className="mt-2">
//                             <AlertCircle className="h-4 w-4" />
//                             <AlertDescription>
//                               <strong>Cannot allocate:</strong>{" "}
//                               {selectedUser.ineligibleReason}
//                             </AlertDescription>
//                           </Alert>
//                         </div>
//                       )}
//                     {selectedUser.floatStatus?.lastReconciliation && (
//                       <div className="col-span-2">
//                         <span className="text-gray-600">
//                           Last Reconciliation:
//                         </span>
//                         <p className="font-medium text-xs">
//                           {new Date(
//                             selectedUser.floatStatus.lastReconciliation
//                           ).toLocaleString()}
//                         </p>
//                       </div>
//                     )}
//                   </div>
//                 </CardContent>
//               </Card>
//             )}

//             {/* Action Buttons */}
//             <div className="flex gap-3 pt-4">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={onClose}
//                 disabled={isSubmitting}
//                 className="flex-1"
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={
//                   isSubmitting ||
//                   allTellers.length === 0 ||
//                   vaultBalance === 0 ||
//                   !canAllocate
//                 }
//                 className="flex-1"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Allocating...
//                   </>
//                 ) : (
//                   <>
//                     <DollarSign className="mr-2 h-4 w-4" />
//                     Allocate Float
//                   </>
//                 )}
//               </Button>
//             </div>
//           </form>
//         </Form>
//       </DialogContent>
//     </Dialog>
//   );
// }
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Branch {
  id: string;
  name: string;
  location?: string | null;
}

interface FloatStatus {
  balance: number;
  isActiveForDay: boolean;
  canStartNewDay: boolean;
  pendingReconciliation: boolean;
  currentDayStarted: Date | null;
  lastReconciliation: Date | null;
}

interface TellerAgent {
  id: string;
  name: string;
  email: string | null;
  role: string;
  branch?: {
    id: string;
    name: string;
    location?: string | null;
  };
  floatStatus: FloatStatus | null;
}

interface FloatAllocationCreateFormProps {
  allocatorId: string;
  onSuccess?: () => void;
}

export default function FloatAllocationCreateForm({
  allocatorId,
  onSuccess,
}: FloatAllocationCreateFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [tellers, setTellers] = useState<TellerAgent[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedTellerId, setSelectedTellerId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debug logs
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setDebugLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  // Fetch branches and tellers when dialog opens
  useEffect(() => {
    if (open) {
      fetchInitialData();
    } else {
      // Reset form when dialog closes
      resetForm();
    }
  }, [open]);

  const fetchInitialData = async () => {
    setFetchingData(true);
    setDebugLogs([]);
    addLog("ðŸ”„ Starting data fetch...");

    try {
      addLog("ðŸ“ Fetching branches...");
      const response = await fetch("/api/v1/floats/overview", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch float overview");
      }

      const branchesData = result.data?.branches || [];
      addLog(`âœ… Fetched ${branchesData.length} branches`);
      setBranches(branchesData);

      addLog("ðŸ‘¥ Fetching eligible tellers...");
      const tellersData = result.data?.eligibleUsers || [];
      addLog(`âœ… Fetched ${tellersData.length} total users`);

      // Log each user's details
      tellersData.forEach((t: TellerAgent, idx: number) => {
        addLog(
          `  ${idx + 1}. ${t.name} (${t.role}) - Balance: ${t.floatStatus?.balance || 0}, Pending: ${t.floatStatus?.pendingReconciliation || false}`
        );
      });

      setTellers(tellersData);

      addLog("âœ… Data fetch complete!");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to fetch data";
      addLog(`âŒ Error: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setFetchingData(false);
    }
  };

  // Separate tellers into eligible and ineligible
  // âœ… SIMPLIFIED: Only exclude those with pending reconciliation
  const { eligibleTellers, ineligibleTellers } = useMemo(() => {
    if (!tellers || !Array.isArray(tellers)) {
      addLog("âš ï¸ No tellers data available");
      return {
        eligibleTellers: [],
        ineligibleTellers: [],
      };
    }

    addLog(`ðŸ” Processing ${tellers.length} tellers for eligibility...`);

    // âœ… Only exclude if pending reconciliation
    const eligible = tellers.filter((t) => {
      const hasPending = t.floatStatus?.pendingReconciliation === true;

      if (hasPending) {
        addLog(`  âŒ ${t.name}: Excluded (pending reconciliation)`);
        return false;
      }

      addLog(
        `  âœ… ${t.name}: Eligible (balance: ${t.floatStatus?.balance || 0})`
      );
      return true;
    });

    const ineligible = tellers.filter(
      (t) => t.floatStatus?.pendingReconciliation === true
    );

    addLog(
      `ðŸ“Š Result: ${eligible.length} eligible, ${ineligible.length} ineligible`
    );

    return {
      eligibleTellers: eligible,
      ineligibleTellers: ineligible,
    };
  }, [tellers]);

  const resetForm = () => {
    setSelectedBranchId("");
    setSelectedTellerId("");
    setAmount("");
    setDescription("");
    setError(null);
    setSuccess(null);
    setDebugLogs([]);
  };

  const handleSubmit = async () => {
    if (!selectedBranchId || !selectedTellerId || !amount) {
      setError("Please fill in all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    addLog(
      `ðŸ’° Submitting allocation: ${amountNum} to teller ${selectedTellerId}`
    );

    try {
      const response = await fetch("/api/v1/floats/allocate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tellerAgentId: selectedTellerId,
          branchId: selectedBranchId,
          amount: amountNum,
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        addLog(`âŒ Allocation failed: ${result.error}`);
        setError(result.error);
      } else {
        addLog("âœ… Allocation successful!");
        setSuccess(result.message || "Float allocated successfully!");

        // Reset form after short delay
        setTimeout(() => {
          setOpen(false);
          onSuccess?.();
        }, 1500);
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "An unexpected error occurred";
      addLog(`âŒ Exception: ${errorMsg}`);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const selectedTeller = tellers.find((t) => t.id === selectedTellerId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Allocate Float
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Float to Teller/Agent</DialogTitle>
        </DialogHeader>

        {fetchingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading data...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {success && (
              <Alert className="bg-green-50 text-green-900 border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select
                value={selectedBranchId}
                onValueChange={setSelectedBranchId}
              >
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} {branch.location && `- ${branch.location}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Teller Selection */}
            <div className="space-y-2">
              <Label htmlFor="teller">Teller/Agent *</Label>
              <Select
                value={selectedTellerId}
                onValueChange={setSelectedTellerId}
              >
                <SelectTrigger id="teller">
                  <SelectValue placeholder="Select teller/agent" />
                </SelectTrigger>
                <SelectContent>
                  {/* Eligible Tellers */}
                  {eligibleTellers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-700 bg-green-50">
                        âœ… Available ({eligibleTellers.length})
                      </div>
                      {eligibleTellers.map((teller) => (
                        <SelectItem key={teller.id} value={teller.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{teller.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {teller.role} â€¢ Balance: UGX{" "}
                              {teller.floatStatus?.balance.toLocaleString() ||
                                0}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {/* Ineligible Tellers */}
                  {ineligibleTellers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-red-700 bg-red-50">
                        âŒ Unavailable - Pending Reconciliation (
                        {ineligibleTellers.length})
                      </div>
                      {ineligibleTellers.map((teller) => (
                        <SelectItem key={teller.id} value={teller.id} disabled>
                          <div className="flex items-center justify-between w-full opacity-50">
                            <span>{teller.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              Pending Reconciliation
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {eligibleTellers.length === 0 &&
                    ineligibleTellers.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No tellers/agents found
                      </div>
                    )}
                </SelectContent>
              </Select>

              {/* Show selected teller info */}
              {selectedTeller && (
                <div className="text-sm text-muted-foreground mt-1 p-2 bg-muted rounded">
                  <strong>{selectedTeller.name}</strong> â€¢ {selectedTeller.role}
                  {selectedTeller.floatStatus && (
                    <div className="mt-1">
                      Current Balance:{" "}
                      <strong>
                        UGX{" "}
                        {selectedTeller.floatStatus.balance.toLocaleString()}
                      </strong>
                      {selectedTeller.floatStatus.balance > 0 && (
                        <span className="text-blue-600 ml-2">
                          (Top-up allocation)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (UGX) *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1000"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Enter allocation notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Debug Console */}
            {debugLogs.length > 0 && (
              <details className="text-xs border rounded p-2">
                <summary className="cursor-pointer font-semibold">
                  ðŸ› Debug Logs ({debugLogs.length})
                </summary>
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto font-mono">
                  {debugLogs.map((log, idx) => (
                    <div key={idx} className="text-gray-600">
                      {log}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading || fetchingData}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Allocating...
                  </>
                ) : (
                  "Allocate Float"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


