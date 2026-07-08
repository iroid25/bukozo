// // app/dashboard/accountant/components/FloatAllocationForm.tsx
// "use client";

// import { useState, useMemo } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { z } from "zod";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";

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
//   FormDescription,
// } from "@/components/ui/form";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "@/components/ui/command";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   AlertTriangle,
//   CheckCircle,
//   DollarSign,
//   User,
//   Building,
//   Info,
//   Clock,
//   XCircle,
//   ChevronsUpDown,
//   Check,
//   Search,
// } from "lucide-react";
// import { cn } from "@/lib/utils";


// interface EligibleUser {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   branch?: {
//     id: string;
//     name: string;
//     location: string;
//   };
//   floatStatus?: {
//     balance: number;
//     isActiveForDay: boolean;
//     canStartNewDay: boolean;
//     pendingReconciliation: boolean;
//     currentDayStarted?: Date;
//     lastReconciliation?: Date;
//   } | null;
// }

// interface Branch {
//   id: string;
//   name: string;
//   location: string;
// }

// const floatAllocationSchema = z.object({
//   tellerAgentId: z.string().min(1, "Please select a teller or agent"),
//   branchId: z.string().min(1, "Please select a branch"),
//   amount: z
//     .string()
//     .min(1, "Amount is required")
//     .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
//       message: "Amount must be greater than zero",
//     }),
//   description: z.string().optional(),
// });

// type FloatAllocationFormValues = z.infer<typeof floatAllocationSchema>;

// interface Props {
//   isOpen: boolean;
//   onClose: () => void;
//   currentUserId: string;
//   eligibleUsers: EligibleUser[];
//   branches: Branch[];
// }

// export default function FloatAllocationCreateForm({
//   isOpen,
//   onClose,
//   currentUserId,
//   eligibleUsers,
//   branches,
// }: Props) {
//   const router = useRouter();
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [selectedUserId, setSelectedUserId] = useState<string>("");
//   const [openUserCombobox, setOpenUserCombobox] = useState(false);
//   const [openBranchCombobox, setOpenBranchCombobox] = useState(false);

//   const form = useForm<FloatAllocationFormValues>({
//     resolver: zodResolver(floatAllocationSchema),
//     defaultValues: {
//       tellerAgentId: "",
//       branchId: "",
//       amount: "",
//       description: "",
//     },
//   });

//   // Get selected user details
//   const selectedUser = useMemo(() => {
//     return eligibleUsers.find((u) => u.id === selectedUserId);
//   }, [selectedUserId, eligibleUsers]);

//   // Determine eligibility status
//   const eligibilityCheck = useMemo(() => {
//     if (!selectedUser) {
//       return { isEligible: false, reason: "No user selected", status: "info" };
//     }

//     const floatStatus = selectedUser.floatStatus;

//     // No float yet - can start
//     if (!floatStatus) {
//       return {
//         isEligible: true,
//         reason: "Ready to receive first allocation",
//         status: "success",
//       };
//     }

//     // Pending reconciliation
//     if (floatStatus.pendingReconciliation) {
//       return {
//         isEligible: false,
//         reason:
//           "Pending end-of-day reconciliation. Must be approved before new allocation.",
//         status: "error",
//       };
//     }

//     // Cannot start new day (previous EOD not approved)
//     if (!floatStatus.canStartNewDay) {
//       return {
//         isEligible: false,
//         reason:
//           "Previous day not reconciled. End-of-day must be approved first.",
//         status: "error",
//       };
//     }

//     // Active day from previous date (stale)
//     if (floatStatus.isActiveForDay && floatStatus.currentDayStarted) {
//       const today = new Date();
//       today.setHours(0, 0, 0, 0);
//       const dayStarted = new Date(floatStatus.currentDayStarted);
//       dayStarted.setHours(0, 0, 0, 0);

//       if (dayStarted.getTime() < today.getTime()) {
//         return {
//           isEligible: false,
//           reason: "Active day is stale. Must submit end-of-day first.",
//           status: "error",
//         };
//       }

//       // Same day top-up allowed
//       if (dayStarted.getTime() === today.getTime()) {
//         return {
//           isEligible: true,
//           reason: "Can receive same-day top-up allocation",
//           status: "success",
//         };
//       }
//     }

//     // Can start new day
//     return {
//       isEligible: true,
//       reason: "Ready to receive start-of-day allocation",
//       status: "success",
//     };
//   }, [selectedUser]);

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const getUserEligibilityBadge = (user: EligibleUser) => {
//     // No float record means they've never received float - they're ready!
//     if (!user.floatStatus) {
//       return (
//         <Badge variant="outline" className="bg-green-50 text-green-700">
//           <CheckCircle className="h-3 w-3 mr-1" />
//           New User
//         </Badge>
//       );
//     }

//     // Has float but it's 0 and no active day
//     if (user.floatStatus.balance === 0 && !user.floatStatus.isActiveForDay) {
//       return (
//         <Badge variant="outline" className="bg-green-50 text-green-700">
//           <CheckCircle className="h-3 w-3 mr-1" />
//           Ready (0 Balance)
//         </Badge>
//       );
//     }

//     const canReceive =
//       !user.floatStatus.pendingReconciliation &&
//       user.floatStatus.canStartNewDay;

//     if (!canReceive) {
//       return (
//         <Badge variant="outline" className="bg-red-50 text-red-700">
//           <XCircle className="h-3 w-3 mr-1" />
//           Blocked
//         </Badge>
//       );
//     }

//     if (user.floatStatus.isActiveForDay) {
//       return (
//         <Badge variant="outline" className="bg-blue-50 text-blue-700">
//           <Clock className="h-3 w-3 mr-1" />
//           Active
//         </Badge>
//       );
//     }

//     return (
//       <Badge variant="outline" className="bg-green-50 text-green-700">
//         <CheckCircle className="h-3 w-3 mr-1" />
//         Ready
//       </Badge>
//     );
//   };

//   const onSubmit = async (data: FloatAllocationFormValues) => {
//     if (!eligibilityCheck.isEligible) {
//       toast.error("Cannot allocate float", {
//         description: eligibilityCheck.reason,
//       });
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       const result = await createFloatAllocation(
//         {
//           tellerAgentId: data.tellerAgentId,
//           branchId: data.branchId,
//           amount: parseFloat(data.amount),
//           description: data.description,
//         },
//         currentUserId
//       );

//       if (result.error) {
//         toast.error("Allocation failed", {
//           description: result.error,
//         });
//         return;
//       }

//       toast.success("Float allocated successfully", {
//         description: `${formatCurrency(parseFloat(data.amount))} allocated to ${
//           selectedUser?.name
//         }`,
//       });

//       form.reset();
//       setSelectedUserId("");
//       onClose();
//       router.refresh();
//     } catch (error) {
//       toast.error("An unexpected error occurred", {
//         description:
//           error instanceof Error ? error.message : "Please try again",
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleClose = () => {
//     if (!isSubmitting) {
//       form.reset();
//       setSelectedUserId("");
//       onClose();
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={handleClose}>
//       <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2">
//             <DollarSign className="h-5 w-5 text-green-600" />
//             Allocate Float to Teller/Agent
//           </DialogTitle>
//           <DialogDescription>
//             Distribute float to eligible tellers and agents for their daily
//             transactions. Only users with no unreconciled balance can receive
//             float.
//           </DialogDescription>
//         </DialogHeader>

//         <Form {...form}>
//           <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
//             {/* Searchable Teller/Agent Selection */}
//             <FormField
//               control={form.control}
//               name="tellerAgentId"
//               render={({ field }) => (
//                 <FormItem className="flex flex-col">
//                   <FormLabel>Select Teller/Agent *</FormLabel>
//                   <Popover
//                     open={openUserCombobox}
//                     onOpenChange={setOpenUserCombobox}
//                   >
//                     <PopoverTrigger asChild>
//                       <FormControl>
//                         <Button
//                           variant="outline"
//                           role="combobox"
//                           className={cn(
//                             "w-full justify-between",
//                             !field.value && "text-muted-foreground"
//                           )}
//                         >
//                           {field.value
//                             ? eligibleUsers.find(
//                                 (user) => user.id === field.value
//                               )?.name
//                             : "Search and select a teller or agent"}
//                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//                         </Button>
//                       </FormControl>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-[600px] p-0" align="start">
//                       <Command>
//                         <CommandInput
//                           placeholder="Search by name, email, or role..."
//                           className="h-9"
//                         />
//                         <CommandList>
//                           <CommandEmpty>
//                             <div className="flex flex-col items-center justify-center py-6 text-center">
//                               <Search className="h-8 w-8 text-gray-400 mb-2" />
//                               <p className="text-sm text-gray-500">
//                                 No tellers or agents found
//                               </p>
//                             </div>
//                           </CommandEmpty>
//                           <CommandGroup>
//                             {eligibleUsers.map((user) => {
//                               const canReceive =
//                                 !user.floatStatus ||
//                                 (!user.floatStatus.pendingReconciliation &&
//                                   user.floatStatus.canStartNewDay);

//                               return (
//                                 <CommandItem
//                                   key={user.id}
//                                   value={`${user.name} ${user.email} ${user.role}`}
//                                   onSelect={() => {
//                                     if (!canReceive) {
//                                       toast.error("Cannot select this user", {
//                                         description: user.floatStatus
//                                           ?.pendingReconciliation
//                                           ? "User has pending end-of-day reconciliation"
//                                           : "User's previous day not reconciled",
//                                       });
//                                       return;
//                                     }
//                                     form.setValue("tellerAgentId", user.id);
//                                     setSelectedUserId(user.id);
//                                     // Auto-populate branch if user has one
//                                     if (user.branch) {
//                                       form.setValue("branchId", user.branch.id);
//                                     }
//                                     setOpenUserCombobox(false);
//                                   }}
//                                   className={cn(
//                                     "py-3 cursor-pointer",
//                                     !canReceive && "opacity-60"
//                                   )}
//                                 >
//                                   <div className="flex items-start gap-3 w-full">
//                                     <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
//                                       <User className="h-4 w-4" />
//                                     </div>
//                                     <div className="flex-1 min-w-0">
//                                       <div className="flex items-center gap-2 mb-1">
//                                         <span className="font-medium">
//                                           {user.name}
//                                         </span>
//                                         <Badge
//                                           variant="outline"
//                                           className="text-xs"
//                                         >
//                                           {user.role}
//                                         </Badge>
//                                         {getUserEligibilityBadge(user)}
//                                       </div>
//                                       <div className="flex items-center gap-3 text-xs text-gray-500">
//                                         <span className="truncate">
//                                           {user.email}
//                                         </span>
//                                         {user.branch && (
//                                           <>
//                                             <span>•</span>
//                                             <span className="truncate">
//                                               {user.branch.name}
//                                             </span>
//                                           </>
//                                         )}
//                                       </div>
//                                       {/* Always show balance info, even if 0 or null */}
//                                       <div className="text-xs text-gray-600 mt-1">
//                                         Current Balance:{" "}
//                                         <span
//                                           className={cn(
//                                             "font-medium",
//                                             !user.floatStatus && "text-blue-600"
//                                           )}
//                                         >
//                                           {user.floatStatus
//                                             ? formatCurrency(
//                                                 user.floatStatus.balance
//                                               )
//                                             : "No float yet (UGX 0)"}
//                                         </span>
//                                       </div>
//                                       {!canReceive && (
//                                         <div className="text-xs text-red-600 mt-1">
//                                           {user.floatStatus
//                                             ?.pendingReconciliation
//                                             ? "⚠ Pending end-of-day reconciliation"
//                                             : "⚠ Previous day not reconciled"}
//                                         </div>
//                                       )}
//                                     </div>
//                                     <Check
//                                       className={cn(
//                                         "h-4 w-4 shrink-0",
//                                         field.value === user.id
//                                           ? "opacity-100"
//                                           : "opacity-0"
//                                       )}
//                                     />
//                                   </div>
//                                 </CommandItem>
//                               );
//                             })}
//                           </CommandGroup>
//                         </CommandList>
//                       </Command>
//                     </PopoverContent>
//                   </Popover>
//                   <FormDescription>
//                     Search and select the teller or agent to receive float
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Eligibility Status Card */}
//             {selectedUser && (
//               <Card
//                 className={
//                   eligibilityCheck.status === "success"
//                     ? "bg-green-50 border-green-200"
//                     : eligibilityCheck.status === "error"
//                       ? "bg-red-50 border-red-200"
//                       : "bg-blue-50 border-blue-200"
//                 }
//               >
//                 <CardContent className="p-4">
//                   <div className="space-y-3">
//                     {/* Eligibility Status */}
//                     <div className="flex items-start gap-3">
//                       {eligibilityCheck.status === "success" ? (
//                         <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
//                       ) : eligibilityCheck.status === "error" ? (
//                         <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
//                       ) : (
//                         <Info className="h-5 w-5 text-blue-600 mt-0.5" />
//                       )}
//                       <div className="flex-1">
//                         <p
//                           className={`font-medium ${
//                             eligibilityCheck.status === "success"
//                               ? "text-green-800"
//                               : eligibilityCheck.status === "error"
//                                 ? "text-red-800"
//                                 : "text-blue-800"
//                           }`}
//                         >
//                           {eligibilityCheck.isEligible
//                             ? "✓ Eligible for Float Allocation"
//                             : "✗ Not Eligible for Float Allocation"}
//                         </p>
//                         <p
//                           className={`text-sm mt-1 ${
//                             eligibilityCheck.status === "success"
//                               ? "text-green-700"
//                               : eligibilityCheck.status === "error"
//                                 ? "text-red-700"
//                                 : "text-blue-700"
//                           }`}
//                         >
//                           {eligibilityCheck.reason}
//                         </p>
//                       </div>
//                     </div>

//                     {/* User Details */}
//                     <div className="grid grid-cols-2 gap-3 pt-3 border-t">
//                       <div className="flex items-center gap-2">
//                         <User className="h-4 w-4 text-gray-500" />
//                         <div>
//                           <p className="text-xs text-gray-500">User</p>
//                           <p className="text-sm font-medium">
//                             {selectedUser.name}
//                           </p>
//                         </div>
//                       </div>
//                       {selectedUser.branch && (
//                         <div className="flex items-center gap-2">
//                           <Building className="h-4 w-4 text-gray-500" />
//                           <div>
//                             <p className="text-xs text-gray-500">Branch</p>
//                             <p className="text-sm font-medium">
//                               {selectedUser.branch.name}
//                             </p>
//                           </div>
//                         </div>
//                       )}
//                       <div className="flex items-center gap-2">
//                         <DollarSign className="h-4 w-4 text-gray-500" />
//                         <div>
//                           <p className="text-xs text-gray-500">
//                             Current Balance
//                           </p>
//                           <p className="text-sm font-medium">
//                             {selectedUser.floatStatus
//                               ? formatCurrency(selectedUser.floatStatus.balance)
//                               : "UGX 0 (No float yet)"}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="flex items-center gap-2">
//                         <Clock className="h-4 w-4 text-gray-500" />
//                         <div>
//                           <p className="text-xs text-gray-500">Status</p>
//                           <Badge
//                             variant="outline"
//                             className={
//                               selectedUser.floatStatus?.isActiveForDay
//                                 ? "bg-green-100 text-green-700"
//                                 : "bg-gray-100 text-gray-700"
//                             }
//                           >
//                             {selectedUser.floatStatus?.isActiveForDay
//                               ? "Active Day"
//                               : "Inactive"}
//                           </Badge>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </CardContent>
//               </Card>
//             )}

//             {/* Searchable Branch Selection */}
//             <FormField
//               control={form.control}
//               name="branchId"
//               render={({ field }) => (
//                 <FormItem className="flex flex-col">
//                   <FormLabel>Branch *</FormLabel>
//                   <Popover
//                     open={openBranchCombobox}
//                     onOpenChange={setOpenBranchCombobox}
//                   >
//                     <PopoverTrigger asChild>
//                       <FormControl>
//                         <Button
//                           variant="outline"
//                           role="combobox"
//                           className={cn(
//                             "w-full justify-between",
//                             !field.value && "text-muted-foreground"
//                           )}
//                         >
//                           {field.value
//                             ? branches.find(
//                                 (branch) => branch.id === field.value
//                               )?.name
//                             : "Search and select a branch"}
//                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//                         </Button>
//                       </FormControl>
//                     </PopoverTrigger>
//                     <PopoverContent className="w-[500px] p-0" align="start">
//                       <Command>
//                         <CommandInput
//                           placeholder="Search branches..."
//                           className="h-9"
//                         />
//                         <CommandList>
//                           <CommandEmpty>No branches found.</CommandEmpty>
//                           <CommandGroup>
//                             {branches.map((branch) => (
//                               <CommandItem
//                                 key={branch.id}
//                                 value={`${branch.name} ${branch.location}`}
//                                 onSelect={() => {
//                                   form.setValue("branchId", branch.id);
//                                   setOpenBranchCombobox(false);
//                                 }}
//                                 className="cursor-pointer"
//                               >
//                                 <div className="flex items-center gap-2 w-full">
//                                   <Building className="h-4 w-4 text-gray-500" />
//                                   <div className="flex-1">
//                                     <p className="font-medium">{branch.name}</p>
//                                     <p className="text-xs text-gray-500">
//                                       {branch.location}
//                                     </p>
//                                   </div>
//                                   <Check
//                                     className={cn(
//                                       "h-4 w-4",
//                                       field.value === branch.id
//                                         ? "opacity-100"
//                                         : "opacity-0"
//                                     )}
//                                   />
//                                 </div>
//                               </CommandItem>
//                             ))}
//                           </CommandGroup>
//                         </CommandList>
//                       </Command>
//                     </PopoverContent>
//                   </Popover>
//                   <FormDescription>
//                     Select the branch for this float allocation
//                   </FormDescription>
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
//                     <Input
//                       type="number"
//                       placeholder="Enter amount (e.g., 500000)"
//                       {...field}
//                       disabled={!eligibilityCheck.isEligible}
//                       className="text-lg"
//                     />
//                   </FormControl>
//                   <FormDescription>
//                     Enter the float amount to allocate in Ugandan Shillings
//                   </FormDescription>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Description */}
//             <FormField
//               control={form.control}
//               name="description"
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel>Description (Optional)</FormLabel>
//                   <FormControl>
//                     <Textarea
//                       placeholder="Add any notes or remarks about this allocation"
//                       rows={3}
//                       {...field}
//                     />
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />

//             {/* Action Buttons */}
//             <div className="flex gap-3 justify-end pt-4 border-t">
//               <Button
//                 type="button"
//                 variant="outline"
//                 onClick={handleClose}
//                 disabled={isSubmitting}
//               >
//                 Cancel
//               </Button>
//               <Button
//                 type="submit"
//                 disabled={
//                   isSubmitting ||
//                   !eligibilityCheck.isEligible ||
//                   !selectedUserId
//                 }
//                 className="min-w-[150px]"
//               >
//                 {isSubmitting ? (
//                   <>
//                     <span className="animate-spin mr-2">⏳</span>
//                     Allocating...
//                   </>
//                 ) : (
//                   <>
//                     <DollarSign className="h-4 w-4 mr-2" />
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
// app/dashboard/accountant/allocate-float/floattwo/FloatAllocationForm.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle,
  DollarSign,
  User,
  Building,
  Info,
  Clock,
  XCircle,
  ChevronsUpDown,
  Check,
  Search,
  Vault,
  Sparkles,
  TrendingUp,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";


interface EligibleUser {
  id: string;
  name: string;
  email: string | null;
  role: string;
  branch?: {
    id: string;
    name: string;
    location: string;
  };
  floatStatus?: {
    balance: number;
    isActiveForDay: boolean;
    canStartNewDay: boolean;
    pendingReconciliation: boolean;
    currentDayStarted?: Date;
    lastReconciliation?: Date;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

const floatAllocationSchema = z.object({
  tellerAgentId: z.string().min(1, "Please select a teller or agent"),
  branchId: z.string().min(1, "Please select a branch"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Amount must be greater than zero",
    }),
  description: z.string().optional(),
});

type FloatAllocationFormValues = z.infer<typeof floatAllocationSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  eligibleUsers: EligibleUser[];
  branches: Branch[];
  vaultBalance: number;
  vaultId?: string;
  vaultData?: any;
}

export default function FloatAllocationCreateForm({
  isOpen,
  onClose,
  currentUserId,
  eligibleUsers,
  branches,
  vaultBalance,
  vaultId,
  vaultData,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [openUserCombobox, setOpenUserCombobox] = useState(false);
  const [openBranchCombobox, setOpenBranchCombobox] = useState(false);

  const form = useForm<FloatAllocationFormValues>({
    resolver: zodResolver(floatAllocationSchema),
    defaultValues: {
      tellerAgentId: "",
      branchId: "",
      amount: "",
      description: "",
    },
  });

  // Get selected user details
  const selectedUser = useMemo(() => {
    return eligibleUsers.find((u) => u.id === selectedUserId);
  }, [selectedUserId, eligibleUsers]);

  // Determine eligibility status
  const eligibilityCheck = useMemo(() => {
    if (!selectedUser) {
      return { isEligible: false, reason: "No user selected", status: "info" };
    }

    const floatStatus = selectedUser.floatStatus;

    if (!floatStatus) {
      return {
        isEligible: true,
        reason: "Ready to receive first allocation",
        status: "success",
      };
    }

    if (floatStatus.pendingReconciliation) {
      return {
        isEligible: false,
        reason:
          "Pending end-of-day reconciliation. Must be approved before new allocation.",
        status: "error",
      };
    }

    if (!floatStatus.canStartNewDay) {
      return {
        isEligible: false,
        reason:
          "Previous day not reconciled. End-of-day must be approved first.",
        status: "error",
      };
    }

    if (floatStatus.isActiveForDay && floatStatus.currentDayStarted) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayStarted = new Date(floatStatus.currentDayStarted);
      dayStarted.setHours(0, 0, 0, 0);

      if (dayStarted.getTime() < today.getTime()) {
        return {
          isEligible: false,
          reason: "Active day is stale. Must submit end-of-day first.",
          status: "error",
        };
      }

      if (dayStarted.getTime() === today.getTime()) {
        return {
          isEligible: true,
          reason: "Can receive same-day top-up allocation",
          status: "success",
        };
      }
    }

    return {
      isEligible: true,
      reason: "Ready to receive start-of-day allocation",
      status: "success",
    };
  }, [selectedUser]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const watchAmount = form.watch("amount");
  const allocationAmount = Number(watchAmount) || 0;
  const hasVault = Boolean(vaultData?.id);
  const vaultLowBalance = hasVault && vaultBalance < 500000;
  const vaultCritical = hasVault && vaultBalance < 100000;
  const insufficientVaultBalance = allocationAmount > vaultBalance;

  const getUserEligibilityBadge = (user: EligibleUser) => {
    if (!user.floatStatus) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200"
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          New User
        </Badge>
      );
    }

    if (user.floatStatus.balance === 0 && !user.floatStatus.isActiveForDay) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200"
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      );
    }

    const canReceive =
      !user.floatStatus.pendingReconciliation &&
      user.floatStatus.canStartNewDay;

    if (!canReceive) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200"
        >
          <XCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    }

    if (user.floatStatus.isActiveForDay) {
      return (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 border-blue-200"
        >
          <Clock className="h-3 w-3 mr-1" />
          Active Today
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-200"
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Ready
      </Badge>
    );
  };

  const onSubmit = async (data: FloatAllocationFormValues) => {
    if (!eligibilityCheck.isEligible) {
      toast.error("Cannot allocate float", {
        description: eligibilityCheck.reason,
      });
      return;
    }

    const allocationAmount = parseFloat(data.amount);

    // Validate amount
    if (isNaN(allocationAmount) || allocationAmount <= 0) {
      toast.error("Invalid amount", {
        description: "Please enter a valid amount greater than zero",
      });
      return;
    }

    // Check vault balance before submitting
    if (allocationAmount > vaultBalance) {
      toast.error("Insufficient vault balance", {
        description: `Requested: ${formatCurrency(allocationAmount)}, Available: ${formatCurrency(vaultBalance)}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("🚀 Submitting float allocation:", {
        tellerAgentId: data.tellerAgentId,
        tellerName: selectedUser?.name,
        branchId: data.branchId,
        amount: allocationAmount,
        currentUserId,
      });

      const response = await fetch("/api/v1/floats/allocate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tellerAgentId: data.tellerAgentId,
          branchId: data.branchId,
          amount: allocationAmount,
          description: data.description,
        }),
      });

      const result = await response.json();

      console.log("📦 Allocation result:", result);

      if (!response.ok || !result.success) {
        console.error("❌ Allocation error:", result.error);
        toast.error("Allocation failed", {
          description: result.error,
        });
        return;
      }

      console.log("✅ Allocation successful");
      toast.success("Float allocated successfully! 🎉", {
        description: `${formatCurrency(allocationAmount)} allocated to ${selectedUser?.name}`,
      });

      form.reset();
      setSelectedUserId("");
      onClose();
      router.refresh();
    } catch (error) {
      console.error("💥 Unexpected error during allocation:", error);
      toast.error("An unexpected error occurred", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      setSelectedUserId("");
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent font-bold">
              Allocate Float
            </span>
          </DialogTitle>
          <DialogDescription className="text-base">
            Distribute float to eligible tellers and agents for their daily
            transactions. System will automatically manage vault balances and
            create all necessary records.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Vault Balance Card */}
            <Card
              className={cn(
                "border-2 transition-all duration-200",
                vaultCritical
                  ? "bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-lg shadow-red-100"
                  : vaultLowBalance
                    ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 shadow-lg shadow-orange-100"
                    : "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300 shadow-lg shadow-blue-100"
              )}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg",
                        vaultCritical
                          ? "bg-gradient-to-br from-red-500 to-rose-600"
                          : vaultLowBalance
                            ? "bg-gradient-to-br from-orange-500 to-amber-600"
                            : "bg-gradient-to-br from-blue-500 to-cyan-600"
                      )}
                    >
                      <Vault className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-semibold uppercase tracking-wide mb-1",
                          vaultCritical
                            ? "text-red-700"
                            : vaultLowBalance
                              ? "text-orange-700"
                              : "text-blue-700"
                        )}
                      >
                        {hasVault ? "Branch Reserve Balance" : "No Active Branch Reserve"}
                      </p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        {hasVault ? formatCurrency(vaultBalance) : "Unavailable"}
                      </p>
                    </div>
                  </div>
                  {!hasVault ? (
                    <div className="text-right">
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-2">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <Badge variant="destructive" className="font-semibold">
                        Reserve Missing
                      </Badge>
                    </div>
                  ) : vaultCritical && (
                    <div className="text-right">
                      <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-2 animate-pulse">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                      </div>
                      <Badge variant="destructive" className="font-semibold">
                        Critical Level
                      </Badge>
                    </div>
                  )}
                  {vaultLowBalance && !vaultCritical && (
                    <div className="text-right">
                      <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                        <AlertTriangle className="h-6 w-6 text-orange-600" />
                      </div>
                      <Badge className="bg-orange-500 font-semibold">
                        Low Balance
                      </Badge>
                    </div>
                  )}
                  {!vaultLowBalance && (
                    <div className="text-right">
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <Badge className="bg-green-500 font-semibold">
                        Healthy
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Separator className="my-6" />

            {/* Teller/Agent Selection */}
            <FormField
              control={form.control}
              name="tellerAgentId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Select Teller/Agent *
                  </FormLabel>
                  <Popover
                    open={openUserCombobox}
                    onOpenChange={setOpenUserCombobox}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between h-12 text-base border-2 hover:border-blue-300 transition-colors",
                            !field.value && "text-muted-foreground",
                            field.value && "border-blue-400 bg-blue-50"
                          )}
                        >
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                                <User className="h-4 w-4 text-white" />
                              </div>
                              <span className="font-medium">
                                {
                                  eligibleUsers.find(
                                    (user) => user.id === field.value
                                  )?.name
                                }
                              </span>
                            </div>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Search className="h-4 w-4" />
                              Search and select a teller or agent
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[700px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search by name, email, or role..."
                          className="h-12 text-base"
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <Search className="h-12 w-12 text-gray-400 mb-3" />
                              <p className="text-base font-medium text-gray-700">
                                No tellers or agents found
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                Try adjusting your search terms
                              </p>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {eligibleUsers.map((user) => {
                              const canReceive =
                                !user.floatStatus || user.floatStatus.canStartNewDay;

                              return (
                                <CommandItem
                                  key={user.id}
                                  value={`${user.name} ${user.email} ${user.role}`}
                                  onSelect={() => {
                                    if (!canReceive) {
                                      toast.error("Cannot select this user", {
                                        description: user.floatStatus
                                          ?.pendingReconciliation
                                          ? "User has pending end-of-day reconciliation"
                                          : "User's previous day not reconciled",
                                      });
                                      return;
                                    }
                                    form.setValue("tellerAgentId", user.id);
                                    setSelectedUserId(user.id);
                                    if (user.branch) {
                                      form.setValue("branchId", user.branch.id);
                                    }
                                    setOpenUserCombobox(false);
                                  }}
                                  className={cn(
                                    "py-4 cursor-pointer hover:bg-blue-50 transition-colors",
                                    !canReceive &&
                                      "opacity-60 cursor-not-allowed",
                                    field.value === user.id &&
                                      "bg-blue-50 border-l-4 border-blue-500"
                                  )}
                                >
                                  <div className="flex items-start gap-3 w-full">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md shrink-0">
                                      <User className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className="font-semibold text-base">
                                          {user.name}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="text-xs font-medium"
                                        >
                                          {user.role}
                                        </Badge>
                                        {getUserEligibilityBadge(user)}
                                      </div>
                                      <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <span className="truncate">
                                          {user.email}
                                        </span>
                                        {user.branch && (
                                          <>
                                            <span>•</span>
                                            <span className="truncate flex items-center gap-1">
                                              <Building className="h-3 w-3" />
                                              {user.branch.name}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm mt-1.5">
                                        <span className="text-gray-600">
                                          Current Balance:
                                        </span>
                                        <span
                                          className={cn(
                                            "font-semibold",
                                            !user.floatStatus &&
                                              "text-blue-600",
                                            user.floatStatus &&
                                              user.floatStatus.balance > 0 &&
                                              "text-green-600",
                                            user.floatStatus &&
                                              user.floatStatus.balance === 0 &&
                                              "text-gray-600"
                                          )}
                                        >
                                          {user.floatStatus
                                            ? formatCurrency(
                                                user.floatStatus.balance
                                              )
                                            : "No float yet (UGX 0)"}
                                        </span>
                                      </div>
                                      {!canReceive && (
                                        <div className="flex items-center gap-1 text-sm text-red-600 mt-1.5 font-medium">
                                          <AlertTriangle className="h-3 w-3" />
                                          {user.floatStatus?.pendingReconciliation 
                                            ? "Pending reconciliation" 
                                            : !user.floatStatus?.canStartNewDay 
                                            ? "Cannot start new day" 
                                            : "Not eligible for allocation"}
                                        </div>
                                      )}
                                    </div>
                                    <Check
                                      className={cn(
                                        "h-5 w-5 shrink-0 text-blue-600",
                                        field.value === user.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                  </div>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Search and select the teller or agent to receive float
                    allocation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Eligibility Status Card */}
            {selectedUser && (
              <Card
                className={cn(
                  "border-2 transition-all duration-200",
                  eligibilityCheck.status === "success"
                    ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-lg shadow-green-100"
                    : eligibilityCheck.status === "error"
                      ? "bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-lg shadow-red-100"
                      : "bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300 shadow-lg shadow-blue-100"
                )}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                          eligibilityCheck.status === "success"
                            ? "bg-gradient-to-br from-green-500 to-emerald-600"
                            : eligibilityCheck.status === "error"
                              ? "bg-gradient-to-br from-red-500 to-rose-600"
                              : "bg-gradient-to-br from-blue-500 to-cyan-600"
                        )}
                      >
                        {eligibilityCheck.status === "success" ? (
                          <CheckCircle className="h-6 w-6 text-white" />
                        ) : eligibilityCheck.status === "error" ? (
                          <XCircle className="h-6 w-6 text-white" />
                        ) : (
                          <Info className="h-6 w-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={cn(
                            "font-bold text-lg mb-1",
                            eligibilityCheck.status === "success"
                              ? "text-green-800"
                              : eligibilityCheck.status === "error"
                                ? "text-red-800"
                                : "text-blue-800"
                          )}
                        >
                          {eligibilityCheck.isEligible
                            ? "✓ Eligible for Float Allocation"
                            : "✗ Not Eligible for Float Allocation"}
                        </p>
                        <p
                          className={cn(
                            "text-base",
                            eligibilityCheck.status === "success"
                              ? "text-green-700"
                              : eligibilityCheck.status === "error"
                                ? "text-red-700"
                                : "text-blue-700"
                          )}
                        >
                          {eligibilityCheck.reason}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            User
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {selectedUser.name}
                          </p>
                        </div>
                      </div>

                      {selectedUser.branch && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 backdrop-blur-sm">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0">
                            <Building className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Branch
                            </p>
                            <p className="text-sm font-bold text-gray-800">
                              {selectedUser.branch.name}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 backdrop-blur-sm">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0">
                          <DollarSign className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Current Balance
                          </p>
                          <p className="text-sm font-bold text-gray-800">
                            {selectedUser.floatStatus
                              ? formatCurrency(selectedUser.floatStatus.balance)
                              : "UGX 0"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white/60 backdrop-blur-sm">
                        <div
                          className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            selectedUser.floatStatus?.isActiveForDay
                              ? "bg-gradient-to-br from-green-500 to-emerald-600"
                              : "bg-gradient-to-br from-gray-400 to-gray-600"
                          )}
                        >
                          <Clock className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            Status
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold",
                              selectedUser.floatStatus?.isActiveForDay
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                            )}
                          >
                            {selectedUser.floatStatus?.isActiveForDay
                              ? "Active Day"
                              : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Branch Selection */}
            <FormField
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Branch *
                  </FormLabel>
                  <Popover
                    open={openBranchCombobox}
                    onOpenChange={setOpenBranchCombobox}
                  >
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between h-12 text-base border-2 hover:border-blue-300 transition-colors",
                            !field.value && "text-muted-foreground",
                            field.value && "border-blue-400 bg-blue-50"
                          )}
                        >
                          {field.value ? (
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                                <Building className="h-4 w-4 text-white" />
                              </div>
                              <span className="font-medium">
                                {
                                  branches.find(
                                    (branch) => branch.id === field.value
                                  )?.name
                                }
                              </span>
                            </div>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Search className="h-4 w-4" />
                              Search and select a branch
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[600px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search branches..."
                          className="h-12 text-base"
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex flex-col items-center justify-center py-8">
                              <Building className="h-12 w-12 text-gray-400 mb-3" />
                              <p className="text-base font-medium text-gray-700">
                                No branches found
                              </p>
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            {branches.map((branch) => (
                              <CommandItem
                                key={branch.id}
                                value={`${branch.name} ${branch.location}`}
                                onSelect={() => {
                                  form.setValue("branchId", branch.id);
                                  setOpenBranchCombobox(false);
                                }}
                                className={cn(
                                  "cursor-pointer py-4 hover:bg-blue-50 transition-colors",
                                  field.value === branch.id &&
                                    "bg-blue-50 border-l-4 border-blue-500"
                                )}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md">
                                    <Building className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-semibold text-base">
                                      {branch.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {branch.location}
                                    </p>
                                  </div>
                                  <Check
                                    className={cn(
                                      "h-5 w-5 text-blue-600",
                                      field.value === branch.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select the branch for this float allocation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount Input */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Allocation Amount (UGX) *
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="number"
                        placeholder="Enter amount (e.g., 500000)"
                        {...field}
                        disabled={!eligibilityCheck.isEligible}
                        className={cn(
                          "pl-12 h-14 text-lg font-semibold border-2 transition-colors",
                          !eligibilityCheck.isEligible &&
                            "opacity-50 cursor-not-allowed",
                          field.value &&
                            !insufficientVaultBalance &&
                            "border-green-400 bg-green-50"
                        )}
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Enter the float amount to allocate in Ugandan Shillings
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount Validation Alert */}
            {allocationAmount > 0 && (
              <Card
                className={cn(
                  "border-2 transition-all duration-200",
                  insufficientVaultBalance
                    ? "bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-lg shadow-red-100"
                    : "bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-lg shadow-green-100"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                        insufficientVaultBalance
                          ? "bg-gradient-to-br from-red-500 to-rose-600"
                          : "bg-gradient-to-br from-green-500 to-emerald-600"
                      )}
                    >
                      {insufficientVaultBalance ? (
                        <XCircle className="h-6 w-6 text-white" />
                      ) : (
                        <CheckCircle className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "font-bold text-lg mb-1",
                          insufficientVaultBalance
                            ? "text-red-800"
                            : "text-green-800"
                        )}
                      >
                        {insufficientVaultBalance
                          ? "⚠️ Insufficient Vault Balance"
                          : "✓ Sufficient Vault Balance"}
                      </p>
                      <div className="flex items-center gap-4 text-sm mt-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-semibold",
                              insufficientVaultBalance
                                ? "text-red-700"
                                : "text-green-700"
                            )}
                          >
                            Requested:
                          </span>
                          <span className="font-bold text-base">
                            {formatCurrency(allocationAmount)}
                          </span>
                        </div>
                        <span className="text-gray-400">|</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-semibold",
                              insufficientVaultBalance
                                ? "text-red-700"
                                : "text-green-700"
                            )}
                          >
                            Available:
                          </span>
                          <span className="font-bold text-base">
                            {formatCurrency(vaultBalance)}
                          </span>
                        </div>
                      </div>
                      {!insufficientVaultBalance && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
                          <ShieldCheck className="h-4 w-4" />
                          <span className="font-medium">
                            Remaining after allocation:{" "}
                            {formatCurrency(vaultBalance - allocationAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes or remarks about this allocation (e.g., Start of day float, Top-up allocation)"
                      rows={3}
                      {...field}
                      className="border-2 resize-none text-base transition-colors hover:border-blue-300 focus:border-blue-400"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional notes about this float allocation for record
                    keeping
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-12 px-6 text-base font-semibold border-2 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !eligibilityCheck.isEligible ||
                  !selectedUserId ||
                  insufficientVaultBalance
                }
                className={cn(
                  "h-12 px-8 text-base font-bold min-w-[180px] shadow-lg transition-all duration-200",
                  !isSubmitting &&
                    eligibilityCheck.isEligible &&
                    selectedUserId &&
                    !insufficientVaultBalance
                    ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:scale-105"
                    : "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Allocating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Allocate Float
                  </>
                )}
              </Button>
            </div>

            {/* Info Footer */}
            <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">
                      What happens when you allocate float:
                    </p>
                    <ul className="space-y-1 text-blue-700">
                      <li>
                        • Vault balance will be decreased by the allocation
                        amount
                      </li>
                      <li>• User's float balance will be increased</li>
                      <li>
                        • All transactions will be recorded in the audit log
                      </li>
                      <li>
                        • An allocation record will be automatically created
                      </li>
                      <li>• User will be able to start their working day</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
