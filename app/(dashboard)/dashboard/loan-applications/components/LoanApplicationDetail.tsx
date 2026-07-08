

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { useForm } from "react-hook-form";

// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
// import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";

// import {
//   ArrowLeft,
//   User,
//   CreditCard,
//   DollarSign,
//   Calendar,
//   FileText,
//   Calculator,
//   CheckCircle,
//   XCircle,
//   Edit,
//   Building,
//   Phone,
//   Mail,
//   Clock,
//   Target,
//   AlertTriangle,
// } from "lucide-react";

// import {
//   LoanApplication,
//   getLoanStatusInfo,
//   LoanApplicationDecisionDTO,
//   calculateLoanDetails,
// } from "@/types/loanApplication";
// import {
//   decideLoanApplication,
//   updateLoanApplication,
// } from "@/actions/loanApplications";

// import TextInput from "@/components/FormInputs/TextInput";
// import SubmitButton from "@/components/FormInputs/SubmitButton";
// import { cn, formatISODate } from "@/lib/utils";
// import { LoanStatus } from "@prisma/client";
// import FormSelectInput from "@/components/FormInputs/FormSelectInput";

// type DisbursementMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";

// interface Props {
//   loanApplication: LoanApplication & {
//     member: {
//       id: string;
//       memberNumber: string;
//       user: {
//         name: string;
//         email: string;
//         phone: string | null;
//         image: string | null;
//       };
//       accounts: Array<{
//         id: string;
//         accountNumber: string;
//         balance: number;
//         accountType: { name: string };
//         branch: { name: string; location: string };
//       }>;
//     };
//     loan?: {
//       id: string;
//       amountGranted: number;
//       totalAmountDue: number;
//       outstandingBalance: number;
//       disbursementDate: Date | null;
//       dueDate: Date;
//       repayments: Array<{
//         id: string;
//         amount: number;
//         repaymentDate: Date;
//       }>;
//       branch?: { name: string; location: string } | null;
//     } | null;
//   };
//   userRole: string;
//   currentUserId: string;
//   tellers: any[];
// }

// type DecisionForm = {
//   rejectionReason?: string;
//   amountGranted?: number;
//   allocatedTellerId?: string; // we mirror selected teller id into this field
//   disbursementMethod?: DisbursementMethod;
// };

// export default function LoanApplicationDetail({
//   loanApplication,
//   userRole,
//   currentUserId,
//   tellers,
// }: Props) {
//   const router = useRouter();

//   const [editMode, setEditMode] = useState(false);
//   const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
//   const [decisionType, setDecisionType] = useState<"approve" | "reject" | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [selectedTeller, setSelectedTeller] = useState<any>(tellers?.[0] ?? null);

//   const statusInfo = getLoanStatusInfo(loanApplication.status);

//   // Role gates
//   const canEdit =
//     loanApplication.status === LoanStatus.PENDING &&
//     ["ADMIN", "LOANOFFICER", "BRANCHMANAGER"].includes(userRole);

//   const canApproveReject =
//     loanApplication.status === LoanStatus.PENDING &&
//     ["ADMIN", "BRANCHMANAGER"].includes(userRole); // MANAGER is not in your enum; using BRANCHMANAGER

//   // Helpers
//   const getTellerId = (t: any) => t?.id ?? t?.value ?? undefined;

//   const formatCurrency = (amount: number) =>
//     new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);

//   const getAccountTypeDisplayName = (name: string) => {
//     const displayNames: Record<string, string> = {
//       VOLUNTARY_SAVINGS: "Voluntary Savings",
//       FIXED_DEPOSIT: "Fixed Deposit",
//       EMERGENCY_SAVINGS: "Emergency Savings",
//     };
//     return displayNames[name] || name;
//   };

//   const loanCalculation = useMemo(
//     () =>
//       calculateLoanDetails(
//         loanApplication.amountApplied,
//         loanApplication.loanProduct.interestRate,
//         loanApplication.loanProduct.repaymentPeriodDays
//       ),
//     [
//       loanApplication.amountApplied,
//       loanApplication.loanProduct.interestRate,
//       loanApplication.loanProduct.repaymentPeriodDays,
//     ]
//   );

//   // Form: edit application
//   const {
//     register: registerEdit,
//     handleSubmit: handleSubmitEdit,
//     formState: { errors: editErrors },
//     reset: resetEdit,
//   } = useForm({
//     defaultValues: {
//       amountApplied: loanApplication.amountApplied,
//       purpose: loanApplication.purpose || "",
//     },
//   });

//   // Form: decision (approve/reject)
//   const {
//     register: registerDecision,
//     handleSubmit: handleSubmitDecision,
//     setValue,
//     formState: { errors: decisionErrors },
//     reset: resetDecision,
//   } = useForm<DecisionForm>({
//     defaultValues: {
//       disbursementMethod: "CASH",
//       // allocatedTellerId will be mirrored in useEffect below
//     },
//   });

//   // Keep RHF in sync with the selected teller so allocatedTellerId is always present
//   useEffect(() => {
//     if (selectedTeller) {
//       setValue("allocatedTellerId", getTellerId(selectedTeller));
//     }
//   }, [selectedTeller, setValue]);

//   // Handlers
//   const handleEditApplication = async (data: { amountApplied: number; purpose: string }) => {
//     try {
//       setLoading(true);
//       const result = await updateLoanApplication({
//         id: loanApplication.id,
//         amountApplied: Number(data.amountApplied),
//         purpose: data.purpose.trim() || undefined,
//       });

//       if (result.error) {
//         toast.error("Failed to update application", { description: result.error });
//         return;
//       }

//       toast.success("Application updated successfully");
//       setEditMode(false);
//       router.refresh();
//     } catch {
//       toast.error("Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDecision = async (data: DecisionForm) => {
//     if (!decisionType) return;

//     try {
//       setLoading(true);

//       // Ensure both new fields are present:
//       const allocatedTellerId = data.allocatedTellerId ?? getTellerId(selectedTeller) ?? null;
//       const disbursementMethod: DisbursementMethod =
//         data.disbursementMethod ?? "CASH";

//       const decisionData: LoanApplicationDecisionDTO & {
//         allocatedTellerId?: string | null;
//         disbursementMethod?: DisbursementMethod;
//       } = {
//         id: loanApplication.id,
//         status: decisionType === "approve" ? "APPROVED" : "REJECTED",
//         rejectionReason: decisionType === "reject" ? data.rejectionReason : undefined,
//         amountGranted:
//           decisionType === "approve"
//             ? Number(data.amountGranted) || loanApplication.amountApplied
//             : undefined,
//         allocatedTellerId: decisionType === "approve" ? allocatedTellerId : undefined,
//         disbursementMethod: decisionType === "approve" ? disbursementMethod : undefined,
//       };

//       const result = await decideLoanApplication(decisionData, currentUserId);

//       if (result.error) {
//         toast.error(`Failed to ${decisionType} application`, {
//           description: result.error,
//         });
//         return;
//       }

//       toast.success(`Application ${decisionType}d successfully`);
//       setDecisionDialogOpen(false);
//       setDecisionType(null);
//       resetDecision();
//       router.refresh();
//     } catch {
//       toast.error("Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="container mx-auto py-6 space-y-6">
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div className="flex items-center gap-4">
//           <Button variant="outline" size="sm" onClick={() => router.back()}>
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back
//           </Button>
//           <div>
//             <h1 className="text-2xl font-bold">Loan Application Details</h1>
//             <p className="text-gray-600">Application ID: {loanApplication.id}</p>
//           </div>
//         </div>

//         <div className="flex items-center gap-3">
//           <Badge className={`${statusInfo.color} text-base px-3 py-1`}>
//             {statusInfo.icon} {statusInfo.label}
//           </Badge>

//           {loanApplication.status === LoanStatus.PENDING && (
//             <>
//               {canApproveReject && (
//                 <div className="flex gap-2">
//                   <Button
//                     variant="default"
//                     size="sm"
//                     onClick={() => {
//                       setDecisionType("approve");
//                       setDecisionDialogOpen(true);
//                     }}
//                   >
//                     <CheckCircle className="h-4 w-4 mr-2" />
//                     Approve
//                   </Button>

//                   <Button
//                     variant="destructive"
//                     size="sm"
//                     onClick={() => {
//                       setDecisionType("reject");
//                       setDecisionDialogOpen(true);
//                     }}
//                   >
//                     <XCircle className="h-4 w-4 mr-2" />
//                     Reject
//                   </Button>
//                 </div>
//               )}

//               {!editMode && canEdit && (
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => {
//                     setEditMode(true);
//                     resetEdit({
//                       amountApplied: loanApplication.amountApplied,
//                       purpose: loanApplication.purpose || "",
//                     });
//                   }}
//                 >
//                   <Edit className="h-4 w-4 mr-2" />
//                   Edit Application
//                 </Button>
//               )}
//             </>
//           )}
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Main Content */}
//         <div className="lg:col-span-2 space-y-6">
//           {/* Application Details */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <FileText className="h-5 w-5" />
//                 Application Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               {editMode ? (
//                 <form onSubmit={handleSubmitEdit(handleEditApplication)} className="space-y-4">
//                   <TextInput
//                     register={registerEdit}
//                     errors={editErrors}
//                     label="Loan Amount"
//                     name="amountApplied"
//                     type="number"
//                     icon={DollarSign}
//                   />

//                   <div className="space-y-2">
//                     <Label>Purpose</Label>
//                     <Textarea
//                       {...registerEdit("purpose")}
//                       placeholder="Loan purpose..."
//                       className="min-h-[100px]"
//                     />
//                   </div>

//                   <div className="flex gap-2">
//                     <SubmitButton title="Save Changes" loading={loading} />
//                     <Button type="button" variant="outline" onClick={() => setEditMode(false)}>
//                       Cancel
//                     </Button>
//                   </div>
//                 </form>
//               ) : (
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div className="space-y-4">
//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Amount Applied</label>
//                       <p className="text-2xl font-bold text-green-600">
//                         {formatCurrency(loanApplication.amountApplied)}
//                       </p>
//                     </div>

//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Application Date</label>
//                       <div className="flex items-center gap-2">
//                         <Calendar className="h-4 w-4 text-gray-400" />
//                         <p className="font-medium">{formatISODate(loanApplication.applicationDate)}</p>
//                       </div>
//                     </div>

//                     {loanApplication.approvalDate && (
//                       <div>
//                         <label className="text-sm font-medium text-gray-500">
//                           {loanApplication.status === LoanStatus.APPROVED ? "Approval Date" : "Decision Date"}
//                         </label>
//                         <div className="flex items-center gap-2">
//                           <Calendar className="h-4 w-4 text-gray-400" />
//                           <p className="font-medium">{formatISODate(loanApplication.approvalDate)}</p>
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   <div className="space-y-4">
//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Purpose</label>
//                       <div className="flex items-start gap-2">
//                         <Target className="h-4 w-4 text-gray-400 mt-1" />
//                         <p className="text-gray-800">
//                           {loanApplication.purpose || "No purpose specified"}
//                         </p>
//                       </div>
//                     </div>

//                     {loanApplication.rejectionReason && (
//                       <div>
//                         <label className="text-sm font-medium text-red-500">Rejection Reason</label>
//                         <div className="flex items-start gap-2">
//                           <AlertTriangle className="h-4 w-4 text-red-400 mt-1" />
//                           <p className="text-red-700">{loanApplication.rejectionReason}</p>
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               )}
//             </CardContent>
//           </Card>

//           {/* Loan Product Details */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <CreditCard className="h-5 w-5" />
//                 Loan Product Details
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                 <div className="space-y-4">
//                   <div>
//                     <label className="text-sm font-medium text-gray-500">Product Name</label>
//                     <p className="font-medium">{loanApplication.loanProduct.name}</p>
//                   </div>

//                   <div>
//                     <label className="text-sm font-medium text-gray-500">Interest Rate</label>
//                     <p className="font-medium">{loanApplication.loanProduct.interestRate}% per annum</p>
//                   </div>
//                 </div>

//                 <div className="space-y-4">
//                   <div>
//                     <label className="text-sm font-medium text-gray-500">Loan Range</label>
//                     <p className="font-medium">
//                       {formatCurrency(loanApplication.loanProduct.minAmount)} -{" "}
//                       {formatCurrency(loanApplication.loanProduct.maxAmount)}
//                     </p>
//                   </div>

//                   <div>
//                     <label className="text-sm font-medium text-gray-500">Repayment Period</label>
//                     <p className="font-medium">
//                       {Math.floor(loanApplication.loanProduct.repaymentPeriodDays / 30)} months (
//                       {loanApplication.loanProduct.repaymentPeriodDays} days)
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Loan Calculation */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Calculator className="h-5 w-5" />
//                 Loan Calculation
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//                 <div className="text-center p-4 bg-blue-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Principal</p>
//                   <p className="text-xl font-bold text-blue-600">
//                     {formatCurrency(loanCalculation.principal)}
//                   </p>
//                 </div>
//                 <div className="text-center p-4 bg-orange-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Interest</p>
//                   <p className="text-xl font-bold text-orange-600">
//                     {formatCurrency(loanCalculation.interest)}
//                   </p>
//                 </div>
//                 <div className="text-center p-4 bg-red-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Total Due</p>
//                   <p className="text-xl font-bold text-red-600">
//                     {formatCurrency(loanCalculation.totalAmountDue)}
//                   </p>
//                 </div>
//                 <div className="text-center p-4 bg-green-50 rounded-lg">
//                   <p className="text-sm text-gray-600">Monthly Payment</p>
//                   <p className="text-xl font-bold text-green-600">
//                     {formatCurrency(loanCalculation.monthlyPayment)}
//                   </p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Loan Details (if disbursed) */}
//           {loanApplication.loan && (
//             <Card>
//               <CardHeader>
//                 <CardTitle className="flex items-center gap-2">
//                   <Building className="h-5 w-5" />
//                   Active Loan Details
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   <div className="space-y-4">
//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Amount Granted</label>
//                       <p className="text-xl font-bold text-green-600">
//                         {formatCurrency(loanApplication.loan.amountGranted)}
//                       </p>
//                     </div>

//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Disbursement Date</label>
//                       <p className="font-medium">{formatISODate(loanApplication.loan.disbursementDate)}</p>
//                     </div>
//                   </div>

//                   <div className="space-y-4">
//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Outstanding Balance</label>
//                       <p className="text-xl font-bold text-red-600">
//                         {formatCurrency(loanApplication.loan.outstandingBalance)}
//                       </p>
//                     </div>

//                     <div>
//                       <label className="text-sm font-medium text-gray-500">Due Date</label>
//                       <p className="font-medium">{formatISODate(loanApplication.loan.dueDate)}</p>
//                     </div>
//                   </div>
//                 </div>

//                 {loanApplication.loan.repayments.length > 0 && (
//                   <div className="mt-6">
//                     <h4 className="font-medium mb-3">Recent Payments</h4>
//                     <div className="space-y-2">
//                       {loanApplication.loan.repayments.slice(0, 3).map((payment) => (
//                         <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
//                           <span>{formatISODate(payment.repaymentDate)}</span>
//                           <span className="font-medium text-green-600">
//                             {formatCurrency(payment.amount)}
//                           </span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//               </CardContent>
//             </Card>
//           )}
//         </div>

//         {/* Sidebar */}
//         <div className="space-y-6">
//           {/* Member Information */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <User className="h-5 w-5" />
//                 Member Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <div className="flex items-center gap-3">
//                 <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
//                   {loanApplication.member.user.image ? (
//                     <img
//                       src={loanApplication.member.user.image}
//                       alt={loanApplication.member.user.name}
//                       className="h-12 w-12 rounded-full object-cover"
//                     />
//                   ) : (
//                     <User className="h-6 w-6 text-gray-600" />
//                   )}
//                 </div>
//                 <div>
//                   <p className="font-medium">{loanApplication.member.user.name}</p>
//                   <p className="text-sm text-gray-500">#{loanApplication.member.memberNumber}</p>
//                 </div>
//               </div>

//               <Separator />

//               <div className="space-y-3">
//                 {loanApplication.member.user.email && (
//                   <div className="flex items-center gap-2">
//                     <Mail className="h-4 w-4 text-gray-400" />
//                     <span className="text-sm">{loanApplication.member.user.email}</span>
//                   </div>
//                 )}

//                 {loanApplication.member.user.phone && (
//                   <div className="flex items-center gap-2">
//                     <Phone className="h-4 w-4 text-gray-400" />
//                     <span className="text-sm">{loanApplication.member.user.phone}</span>
//                   </div>
//                 )}
//               </div>

//               <Separator />

//               <div>
//                 <h4 className="font-medium mb-2">Member Accounts</h4>
//                 <div className="space-y-2">
//                   {loanApplication.member.accounts.map((account) => (
//                     <div key={account.id} className="p-2 bg-gray-50 rounded text-sm">
//                       <div className="flex justify-between">
//                         <span className="font-medium">{account.accountNumber}</span>
//                         <span className="text-green-600">{formatCurrency(account.balance)}</span>
//                       </div>
//                       <div className="text-xs text-gray-500">
//                         {getAccountTypeDisplayName(account.accountType.name)} • {account.branch.name}
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Processing Information */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Clock className="h-5 w-5" />
//                 Processing Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {loanApplication.applicant && (
//                 <div>
//                   <label className="text-sm font-medium text-gray-500">Applied by</label>
//                   <p className="font-medium">{loanApplication.applicant.name}</p>
//                   <p className="text-sm text-gray-500">{loanApplication.applicant.role}</p>
//                 </div>
//               )}

//               {loanApplication.approver && (
//                 <div>
//                   <label className="text-sm font-medium text-gray-500">
//                     {loanApplication.status === LoanStatus.APPROVED ? "Approved by" : "Decided by"}
//                   </label>
//                   <p className="font-medium">{loanApplication.approver.name}</p>
//                   <p className="text-sm text-gray-500">{loanApplication.approver.role}</p>
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       </div>

//       {/* Decision Dialog */}
//       <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
//         <DialogContent className="max-w-md">
//           <DialogHeader>
//             <DialogTitle>
//               {decisionType === "approve" ? "Approve Loan Application" : "Reject Loan Application"}
//             </DialogTitle>
//             <DialogDescription>
//               {decisionType === "approve"
//                 ? "Approve this loan application and create a loan record."
//                 : "Reject this loan application and provide a reason."}
//             </DialogDescription>
//           </DialogHeader>

//           <form onSubmit={handleSubmitDecision(handleDecision)} className="space-y-4">
//             {decisionType === "approve" && (
//               <div className="space-y-4">
//                 <TextInput
//                   register={registerDecision}
//                   errors={decisionErrors}
//                   label="Amount to Grant"
//                   name="amountGranted"
//                   type="number"
//                   icon={DollarSign}
//                 />

//                 <FormSelectInput
//                   label="Teller to issue loan"
//                   options={tellers}
//                   option={selectedTeller}
//                   setOption={(opt: any) => {
//                     setSelectedTeller(opt);
//                     setValue("allocatedTellerId", getTellerId(opt)); // keep RHF in sync
//                   }}
//                 />
//                 {/* Hidden input to ensure RHF always carries the ID */}
//                 <input type="hidden" {...registerDecision("allocatedTellerId")} />

//                 <div className="space-y-2">
//                   <Label>Disbursement Method</Label>
//                   <select
//                     className="border rounded px-3 py-2 w-full"
//                     defaultValue="CASH"
//                     {...registerDecision("disbursementMethod")}
//                   >
//                     <option value="CASH">Cash</option>
//                     <option value="MOBILE_MONEY">Mobile Money</option>
//                   </select>
//                 </div>
//               </div>
//             )}

//             {decisionType === "reject" && (
//               <div className="space-y-2">
//                 <Label>Rejection Reason *</Label>
//                 <Textarea
//                   {...registerDecision("rejectionReason", {
//                     required: "Rejection reason is required",
//                   })}
//                   placeholder="Explain why this application is being rejected..."
//                   className="min-h-[100px]"
//                 />
//                 {decisionErrors.rejectionReason && (
//                   <p className="text-sm text-red-600">{decisionErrors.rejectionReason.message}</p>
//                 )}
//               </div>
//             )}

//             <div className="flex justify-end gap-2">
//               <Button type="button" variant="outline" onClick={() => setDecisionDialogOpen(false)}>
//                 Cancel
//               </Button>
//               <SubmitButton
//                 className={cn("", decisionType === "approve" ? "" : "bg-red-500")}
//                 title={decisionType === "approve" ? "Approve & Create Loan" : "Reject Application"}
//                 loading={loading}
//               />
//             </div>
//           </form>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }


"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Calculator,
  CheckCircle,
  XCircle,
  Edit,
  Building,
  Phone,
  Mail,
  Clock,
  Target,
  AlertTriangle,
  Briefcase,
  Users,
  Shield,
  Percent,
  Minus,
  TrendingDown,
} from "lucide-react";

import {
  LoanApplication,
  getLoanStatusInfo,
  LoanApplicationDecisionDTO,
  calculateLoanDetails,
} from "@/types/loanApplication";

import TextInput from "@/components/FormInputs/TextInput";
import SubmitButton from "@/components/FormInputs/SubmitButton";
import { cn, formatISODate } from "@/lib/utils";
import { LoanStatus } from "@prisma/client";
import FormSelectInput from "@/components/FormInputs/FormSelectInput";

type DisbursementMethod = "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";

interface Props {
  loanApplication: LoanApplication & {
    member: {
      id: string;
      memberNumber: string;
      user: {
        name: string;
        email: string | null;
        phone: string | null;
        image: string | null;
      };
      accounts: Array<{
        id: string;
        accountNumber: string;
        balance: number;
        accountType: { name: string };
        branch: { id: string; name: string; location: string };
      }>;
    };
    loan?: {
      id: string;
      amountGranted: number;
      totalAmountDue: number;
      outstandingBalance: number;
      disbursementDate: Date | null;
      dueDate: Date;
      repayments: Array<{
        id: string;
        amount: number;
        repaymentDate: Date;
      }>;
      branch?: { name: string; location: string } | null;
    } | null;
  };
  userRole: string;
  currentUserId: string;
  tellers: { label: string; value: string; branchId?: string }[];
}

type DecisionForm = {
  rejectionReason?: string;
  amountGranted?: number;
  allocatedTellerId?: string;
  approvedRepaymentPeriod?: number;
  disbursementMethod?: DisbursementMethod;
};

export default function LoanApplicationDetail({
  loanApplication,
  userRole,
  currentUserId,
  tellers,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<"approve" | "reject" | null>(
    null
  );
  const [selectedTeller, setSelectedTeller] = useState<any>(
    tellers?.[0] ?? null
  );

  const statusInfo = getLoanStatusInfo(loanApplication.status);

  // Role gates
  const canEdit =
    loanApplication.status === LoanStatus.PENDING &&
    ["ADMIN", "LOANOFFICER", "BRANCHMANAGER"].includes(userRole);

  const canApproveReject =
    loanApplication.status === LoanStatus.PENDING &&
    ["ADMIN", "BRANCHMANAGER"].includes(userRole);

  // Helpers
  const getTellerId = (t: any) => t?.id ?? t?.value ?? undefined;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: Record<string, string> = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const loanCalculation = useMemo(
    () =>
      calculateLoanDetails(
        loanApplication.amountApplied,
        loanApplication.loanProduct.interestRate,
        loanApplication.loanProduct.repaymentPeriodDays
      ),
    [
      loanApplication.amountApplied,
      loanApplication.loanProduct.interestRate,
      loanApplication.loanProduct.repaymentPeriodDays,
    ]
  );

  // Form: edit application
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm({
    defaultValues: {
      amountApplied: loanApplication.amountApplied,
      purpose: loanApplication.purpose || "",
    },
  });

  // Form: decision (approve/reject)
  const {
    register: registerDecision,
    handleSubmit: handleSubmitDecision,
    setValue,
    watch,
    formState: { errors: decisionErrors },
    reset: resetDecision,
  } = useForm<DecisionForm>({
    defaultValues: {
      disbursementMethod: "CASH",
    },
  });

  const disbursementMethod = watch("disbursementMethod");

  // Keep RHF in sync with the selected teller so allocatedTellerId is always present
  useEffect(() => {
    if (selectedTeller && disbursementMethod !== "MOBILE_MONEY") {
      setValue("allocatedTellerId", getTellerId(selectedTeller));
    }
  }, [selectedTeller, disbursementMethod, setValue]);

  // Hide/clear teller when Mobile Money is selected
  useEffect(() => {
    if (disbursementMethod === "MOBILE_MONEY") {
      setSelectedTeller(null);
      setValue("allocatedTellerId", undefined);
    } else if (!selectedTeller && tellers?.length) {
      // optional: reselect first teller when switching back
      setSelectedTeller(tellers[0]);
      setValue("allocatedTellerId", getTellerId(tellers[0]));
    }
  }, [disbursementMethod, tellers, selectedTeller, setValue]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.patch(`/api/v1/loans/applications/${loanApplication.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Application updated successfully");
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications-process"] });
      router.refresh();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to update application";
      toast.error(message);
    }
  });

  const decisionMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...payload } = data;
      const response = await axios.post(`/api/v1/loans/applications/${id}/decision`, payload);
      return response.data;
    },
    onSuccess: (data, variables) => {
      const type = variables.status === "APPROVED" ? "approved" : "rejected";
      toast.success(`Application ${type} successfully`);
      setDecisionDialogOpen(false);
      setDecisionType(null);
      resetDecision({ disbursementMethod: "CASH" });
      queryClient.invalidateQueries({ queryKey: ["loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["loan-applications-process"] });
      queryClient.invalidateQueries({ queryKey: ["loan-application-statistics"] });
      router.refresh();
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Failed to process decision";
      toast.error(message);
    }
  });

  // Handlers
  const handleEditApplication = async (data: {
    amountApplied: number;
    purpose: string;
  }) => {
    updateMutation.mutate({
      amountApplied: Number(data.amountApplied),
      purpose: data.purpose.trim() || undefined,
    });
  };

  const handleDecision = async (data: DecisionForm) => {
    if (!decisionType) return;

    const method: DisbursementMethod = data.disbursementMethod ?? "CASH";
    const tellerId =
      method === "MOBILE_MONEY"
        ? undefined
        : data.allocatedTellerId ?? getTellerId(selectedTeller) ?? undefined;

    decisionMutation.mutate({
      id: loanApplication.id,
      status: decisionType === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason:
        decisionType === "reject" ? data.rejectionReason : undefined,
      amountGranted:
        decisionType === "approve"
          ? Number(data.amountGranted) || loanApplication.amountApplied
          : undefined,
      allocatedTellerId: decisionType === "approve" ? tellerId : undefined,
      disbursementMethod: decisionType === "approve" ? method : undefined,
      approvedRepaymentPeriod:
        decisionType === "approve"
          ? Number(data.approvedRepaymentPeriod) ||
            loanApplication.repaymentPeriodMonths ||
            undefined
          : undefined,
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Loan Application Details</h1>
            <p className="text-gray-600">Application ID: {loanApplication.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge className={`${statusInfo.color} text-base px-3 py-1`}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>

          {loanApplication.status === LoanStatus.PENDING && (
            <>
              {canApproveReject && (
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setDecisionType("approve");
                      setDecisionDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDecisionType("reject");
                      setDecisionDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}

              {!editMode && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditMode(true);
                    resetEdit({
                      amountApplied: loanApplication.amountApplied,
                      purpose: loanApplication.purpose || "",
                    });
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Application
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {editMode ? (
                <form
                  onSubmit={handleSubmitEdit(handleEditApplication)}
                  className="space-y-4"
                >
                  <TextInput
                    register={registerEdit}
                    errors={editErrors}
                    label="Loan Amount"
                    name="amountApplied"
                    type="number"
                    icon={DollarSign}
                  />

                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <Textarea
                      {...registerEdit("purpose")}
                      placeholder="Loan purpose..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <SubmitButton 
                      title="Save Changes" 
                      loading={updateMutation.isPending} 
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Amount Applied
                      </label>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(loanApplication.amountApplied)}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Application Date
                      </label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <p className="font-medium">
                          {formatISODate(loanApplication.applicationDate)}
                        </p>
                      </div>
                    </div>

                    {loanApplication.approvalDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          {loanApplication.status === LoanStatus.APPROVED
                            ? "Approval Date"
                            : "Decision Date"}
                        </label>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <p className="font-medium">
                            {formatISODate(loanApplication.approvalDate)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Purpose
                      </label>
                      <div className="flex items-start gap-2">
                        <Target className="h-4 w-4 text-gray-400 mt-1" />
                        <p className="text-gray-800">
                          {loanApplication.purpose || "No purpose specified"}
                        </p>
                      </div>
                    </div>

                    {loanApplication.rejectionReason && (
                      <div>
                        <label className="text-sm font-medium text-red-500">
                          Rejection Reason
                        </label>
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-400 mt-1" />
                          <p className="text-red-700">
                            {loanApplication.rejectionReason}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disbursement Status */}
          {loanApplication.status === "APPROVED" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Disbursement Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div>
                        <p className="text-sm font-medium text-blue-900">Status</p>
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 mt-1">
                            Awaiting Disbursement
                        </Badge>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Approved Amount</span>
                        <span className="font-bold text-green-600">
                            {formatCurrency(loanApplication.approvedAmount || loanApplication.amountApplied)}
                        </span>
                    </div>
                    
                    {loanApplication.allocatedTeller && (
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-500">Assigned Teller</span>
                            <span className="font-medium">{loanApplication.allocatedTeller.name}</span>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Disbursement Method</span>
                        <span className="font-medium capitalize">
                            {loanApplication.disbursementMethod || "Cash"}
                        </span>
                    </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loan Product Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Loan Product Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Product Name
                    </label>
                    <p className="font-medium">
                      {loanApplication.loanProduct.name}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Interest Rate
                    </label>
                    <p className="font-medium">
                      {loanApplication.loanProduct.interestRate}% per annum
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Loan Range
                    </label>
                    <p className="font-medium">
                      {formatCurrency(loanApplication.loanProduct.minAmount)} -{" "}
                      {formatCurrency(loanApplication.loanProduct.maxAmount)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      Repayment Period
                    </label>
                    <p className="font-medium">
                      {loanApplication.repaymentPeriodMonths 
                        ? `${loanApplication.repaymentPeriodMonths} months`
                        : `${Math.floor(loanApplication.loanProduct.repaymentPeriodDays / 30)} months (${loanApplication.loanProduct.repaymentPeriodDays} days)`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment & Financial Information */}
          {((loanApplication as any).employer || (loanApplication as any).employmentStatus || (loanApplication as any).grossMonthlyIncome) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Employment & Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(loanApplication as any).employer && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Employer</label>
                      <p className="font-medium">{(loanApplication as any).employer}</p>
                    </div>
                  )}
                  {(loanApplication as any).employmentStatus && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Employment Status</label>
                      <p className="font-medium">{(loanApplication as any).employmentStatus}</p>
                    </div>
                  )}
                  {(loanApplication as any).grossMonthlyIncome && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Gross Monthly Income</label>
                      <p className="font-medium text-green-600">{formatCurrency((loanApplication as any).grossMonthlyIncome)}</p>
                    </div>
                  )}
                  {(loanApplication as any).netMonthlyIncome && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Net Monthly Income</label>
                      <p className="font-medium text-blue-600">{formatCurrency((loanApplication as any).netMonthlyIncome)}</p>
                    </div>
                  )}
                  {(loanApplication as any).modeOfRepayment && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Mode of Repayment</label>
                      <p className="font-medium">{(loanApplication as any).modeOfRepayment}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collateral / Security */}
          {((loanApplication as any).collateralType || (loanApplication as any).collateralValue) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Collateral / Security
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(loanApplication as any).collateralType && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Collateral Type</label>
                      <p className="font-medium">{(loanApplication as any).collateralType}</p>
                    </div>
                  )}
                  {(loanApplication as any).collateralValue && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Estimated Value</label>
                      <p className="font-medium text-green-600">{formatCurrency((loanApplication as any).collateralValue)}</p>
                    </div>
                  )}
                  {(loanApplication as any).collateralLocation && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Location</label>
                      <p className="font-medium">{(loanApplication as any).collateralLocation}</p>
                    </div>
                  )}
                  {(loanApplication as any).collateralDetails && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-500">Details</label>
                      <p className="font-medium">{(loanApplication as any).collateralDetails}</p>
                    </div>
                  )}
                  {(loanApplication as any).applyShareDeduction && (loanApplication as any).shareAmount && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Share Capital Deduction</label>
                      <p className="font-medium text-orange-600">{formatCurrency((loanApplication as any).shareAmount)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deductions Breakdown */}
          {((loanApplication as any).applyLoanProcessingFee || (loanApplication as any).applyLoanInsurance || (loanApplication as any).applyShareDeduction) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Deductions Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const app = loanApplication as any;
                  const gross = app.approvedAmount || app.amountApplied;
                  let total = 0;
                  const rows: { label: string; amount: number }[] = [];
                  if (app.applyLoanProcessingFee && app.loanProcessingFeePercentage) {
                    const fee = (gross * app.loanProcessingFeePercentage) / 100;
                    rows.push({ label: `Processing Fee (${app.loanProcessingFeePercentage}%)`, amount: fee });
                    total += fee;
                  }
                  if (app.applyLoanInsurance && app.loanInsurancePercentage) {
                    const ins = (gross * app.loanInsurancePercentage) / 100;
                    rows.push({ label: `Loan Insurance (${app.loanInsurancePercentage}%)`, amount: ins });
                    total += ins;
                  }
                  if (app.applyShareDeduction && app.shareAmount) {
                    rows.push({ label: "Share Capital Contribution", amount: app.shareAmount });
                    total += app.shareAmount;
                  }
                  if (app.hasExistingLoanWithSacco && app.existingLoanBalance) {
                    rows.push({ label: "Existing Loan Recovery", amount: app.existingLoanBalance });
                    total += app.existingLoanBalance;
                  }
                  const net = gross - total;
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Gross Loan Amount</span>
                        <span className="font-bold text-blue-600">{formatCurrency(gross)}</span>
                      </div>
                      {rows.map((r, i) => (
                        <div key={i} className="flex justify-between py-1 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Minus className="h-3 w-3 text-red-400" />
                            {r.label}
                          </span>
                          <span className="text-red-600 font-medium">- {formatCurrency(r.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between py-2 border-t font-semibold">
                        <span>Total Deductions</span>
                        <span className="text-red-600">- {formatCurrency(total)}</span>
                      </div>
                      <div className="flex justify-between py-3 bg-green-50 rounded-lg px-4 border border-green-200">
                        <span className="font-bold text-green-900">Net Amount to Credit</span>
                        <span className="font-bold text-green-700 text-lg">{formatCurrency(net)}</span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Guarantors */}
          {Array.isArray((loanApplication as any).guarantors) && (loanApplication as any).guarantors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Guarantors ({(loanApplication as any).guarantors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(loanApplication as any).guarantors.map((g: any, i: number) => (
                    <div key={i} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-semibold">{g.fullName || "N/A"}</p>
                          {g.relationship && <p className="text-xs text-gray-500">{g.relationship}</p>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {g.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span>{g.phone}</span>
                          </div>
                        )}
                        {g.membershipNumber && (
                          <div>
                            <span className="text-gray-500">Member No.: </span>
                            <span className="font-medium">{g.membershipNumber}</span>
                          </div>
                        )}
                        {g.monthlyIncome && (
                          <div>
                            <span className="text-gray-500">Monthly Income: </span>
                            <span className="font-medium text-green-600">{formatCurrency(g.monthlyIncome)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loan Details (if disbursed) */}
          {loanApplication.loan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Active Loan Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Amount Granted
                      </label>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(loanApplication.loan.amountGranted)}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Disbursement Date
                      </label>
                      <p className="font-medium">
                        {loanApplication.loan.disbursementDate
                          ? formatISODate(loanApplication.loan.disbursementDate)
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Outstanding Balance
                      </label>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency(
                          loanApplication.loan.outstandingBalance
                        )}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        Due Date
                      </label>
                      <p className="font-medium">
                        {formatISODate(loanApplication.loan.dueDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {loanApplication.loan.repayments.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Recent Payments</h4>
                    <div className="space-y-2">
                      {loanApplication.loan.repayments
                        .slice(0, 3)
                        .map((payment) => (
                          <div
                            key={payment.id}
                            className="flex justify-between items-center p-3 bg-gray-50 rounded"
                          >
                            <span>{formatISODate(payment.repaymentDate)}</span>
                            <span className="font-medium text-green-600">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Member Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Member Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                  {loanApplication.member.user.image ? (
                    <img
                      src={loanApplication.member.user.image}
                      alt={loanApplication.member.user.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-gray-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {loanApplication.member.user.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    #{loanApplication.member.memberNumber}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {loanApplication.member.user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {loanApplication.member.user.email}
                    </span>
                  </div>
                )}

                {loanApplication.member.user.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      {loanApplication.member.user.phone}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Member Accounts</h4>
                <div className="space-y-2">
                  {loanApplication.member.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-2 bg-gray-50 rounded text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {account.accountNumber}
                        </span>
                        <span className="text-green-600">
                          {formatCurrency(account.balance)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {getAccountTypeDisplayName(account.accountType.name)} •{" "}
                        {account.branch.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Processing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Processing Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loanApplication.applicant && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Applied by
                  </label>
                  <p className="font-medium">
                    {loanApplication.applicant.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {loanApplication.applicant.role}
                  </p>
                </div>
              )}

              {loanApplication.approver && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    {loanApplication.status === LoanStatus.APPROVED
                      ? "Approved by"
                      : "Decided by"}
                  </label>
                  <p className="font-medium">{loanApplication.approver.name}</p>
                  <p className="text-sm text-gray-500">
                    {loanApplication.approver.role}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionType === "approve"
                ? "Approve Loan Application"
                : "Reject Loan Application"}
            </DialogTitle>
            <DialogDescription>
              {decisionType === "approve"
                ? "Approve this loan application and create a loan record."
                : "Reject this loan application and provide a reason."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmitDecision(handleDecision)}
            className="space-y-4"
          >
            {decisionType === "approve" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    register={registerDecision}
                    errors={decisionErrors}
                    label="Amount to Grant"
                    name="amountGranted"
                    type="number"
                    icon={DollarSign}
                  />
                  <TextInput
                    register={registerDecision}
                    errors={decisionErrors}
                    label="Period (Months)"
                    name="approvedRepaymentPeriod"
                    type="number"
                    icon={Calculator}
                    placeholder={
                      loanApplication.repaymentPeriodMonths
                        ? `${loanApplication.repaymentPeriodMonths}`
                        : `${Math.ceil(
                            loanApplication.loanProduct.repaymentPeriodDays / 30
                          )}`
                    }
                  />
                </div>

                {/* Disbursement Method */}
                <div className="space-y-2">
                  <Label>Disbursement Method</Label>
                  <select
                    className="border rounded px-3 py-2 w-full"
                    defaultValue="CASH"
                    {...registerDecision("disbursementMethod")}
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>

                {/* Teller (hidden when Mobile Money) */}
                {disbursementMethod !== "MOBILE_MONEY" && (
                  <>
                    <div className="space-y-1">
                      <FormSelectInput
                        label="Teller to issue loan"
                        options={tellers.filter((t) => {
                           const memberBranchId = loanApplication.member.accounts[0]?.branch?.id || (loanApplication.member.accounts[0]?.branch as any)?.id; 
                           // Fallback to all if no branch found, or if match
                           return !memberBranchId || t.branchId === memberBranchId;
                        })}
                        option={selectedTeller}
                        setOption={(opt: any) => {
                          setSelectedTeller(opt);
                          setValue(
                            "allocatedTellerId",
                            getTellerId(opt) ?? undefined
                          );
                        }}
                      />
                      {loanApplication.member.accounts[0]?.branch && (
                          <p className="text-xs text-muted-foreground">
                            Filtering tellers for branch: {loanApplication.member.accounts[0].branch.name}
                          </p>
                      )}
                    </div>
                    {/* Keep RHF in sync even if component changes */}
                    <input
                      type="hidden"
                      {...registerDecision("allocatedTellerId")}
                    />
                  </>
                )}
              </div>
            )}

            {decisionType === "reject" && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  {...registerDecision("rejectionReason", {
                    required: "Rejection reason is required",
                  })}
                  placeholder="Explain why this application is being rejected..."
                  className="min-h-[100px]"
                />
                {decisionErrors.rejectionReason && (
                  <p className="text-sm text-red-600">
                    {decisionErrors.rejectionReason.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDecisionDialogOpen(false)}
              >
                Cancel
              </Button>
              <SubmitButton
                className={cn(
                  "",
                  decisionType === "approve" ? "" : "bg-red-500"
                )}
                title={
                  decisionType === "approve"
                    ? "Approve & Create Loan"
                    : "Reject Application"
                }
                loading={decisionMutation.isPending}
              />
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
