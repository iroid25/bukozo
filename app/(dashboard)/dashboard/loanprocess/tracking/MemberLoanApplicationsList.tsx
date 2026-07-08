// // app/dashboard/member/loan-applications/page.tsx
// import { Suspense } from "react";
// import { getAuthUser } from "@/config/useAuth";
// import { getLoanApplicationsByMemberId } from "@/actions/loanApplications";
// import { redirect } from "next/navigation";
// import MemberLoanApplicationsList from "./components/MemberLoanApplicationsList";
// import { db } from "@/prisma/db";

// async function MemberLoanApplicationsContent() {
//   const user = await getAuthUser();

//   if (!user) {
//     redirect("/login");
//   }

//   // Find member record for current user
//   const member = await db.member.findUnique({
//     where: { userId: user.id },
//     select: { id: true },
//   });

//   if (!member) {
//     redirect("/dashboard");
//   }

//   const loanApplications = await getLoanApplicationsByMemberId(member.id);

//   return (
//     <MemberLoanApplicationsList
//       applications={loanApplications}
//       memberId={member.id}
//     />
//   );
// }

// function LoadingState() {
//   return (
//     <div className="flex items-center justify-center h-96">
//       <div className="text-center">
//         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
//         <p className="text-gray-600">Loading your loan applications...</p>
//       </div>
//     </div>
//   );
// }

// export default function MemberLoanApplicationsPage() {
//   return (
//     <div className="container mx-auto py-8 px-4">
//       <Suspense fallback={<LoadingState />}>
//         <MemberLoanApplicationsContent />
//       </Suspense>
//     </div>
//   );
// }

// ---

// // app/dashboard/member/loan-applications/components/MemberLoanApplicationsList.tsx
// "use client";

// import React, { useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   CreditCard,
//   Calendar,
//   DollarSign,
//   CheckCircle,
//   Clock,
//   XCircle,
//   AlertCircle,
//   Eye,
//   TrendingUp,
//   FileText,
//   ArrowRight,
//   Download,
//   Share2,
// } from "lucide-react";
// import { useRouter } from "next/navigation";

// interface LoanApplication {
//   id: string;
//   amountApplied: number;
//   applicationDate: Date;
//   approvalDate?: Date | null;
//   status: string;
//   purpose?: string | null;
//   rejectionReason?: string | null;
//   loanProduct: {
//     name: string;
//     interestRate: number;
//     repaymentPeriodDays: number;
//   };
//   loan?: {
//     amountGranted: number;
//     totalAmountDue: number;
//     outstandingBalance: number;
//     dueDate: Date;
//     disbursementDate: Date;
//   };
// }

// interface Props {
//   applications: LoanApplication[];
//   memberId: string;
// }

// const MemberLoanApplicationsList: React.FC<Props> = ({
//   applications,
// }) => {
//   const router = useRouter();
//   const [filter, setFilter] = useState("ALL");
//   const [expandedId, setExpandedId] = useState<string | null>(null);

//   const getStatusInfo = (status: string) => {
//     const statusMap: Record<
//       string,
//       {
//         color: string;
//         bgColor: string;
//         borderColor: string;
//         label: string;
//         description: string;
//       }
//     > = {
//       PENDING: {
//         color: "text-yellow-800",
//         bgColor: "bg-yellow-50",
//         borderColor: "border-yellow-200",
//         label: "Pending Review",
//         description: "Your application is being reviewed by the management",
//       },
//       APPROVED: {
//         color: "text-blue-800",
//         bgColor: "bg-blue-50",
//         borderColor: "border-blue-200",
//         label: "Approved",
//         description: "Your application has been approved and is ready for disbursement",
//       },
//       DISBURSED: {
//         color: "text-green-800",
//         bgColor: "bg-green-50",
//         borderColor: "border-green-200",
//         label: "Disbursed",
//         description: "Funds have been transferred to your account",
//       },
//       REJECTED: {
//         color: "text-red-800",
//         bgColor: "bg-red-50",
//         borderColor: "border-red-200",
//         label: "Rejected",
//         description: "Your application was not approved",
//       },
//       REPAID: {
//         color: "text-slate-800",
//         bgColor: "bg-slate-50",
//         borderColor: "border-slate-200",
//         label: "Repaid",
//         description: "Loan has been fully repaid",
//       },
//     };
//     return (
//       statusMap[status] || {
//         color: "text-gray-800",
//         bgColor: "bg-gray-50",
//         borderColor: "border-gray-200",
//         label: "Unknown",
//         description: "Status unknown",
//       }
//     );
//   };

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case "PENDING":
//         return <Clock className="h-5 w-5" />;
//       case "APPROVED":
//         return <CheckCircle className="h-5 w-5" />;
//       case "DISBURSED":
//         return <CheckCircle className="h-5 w-5" />;
//       case "REJECTED":
//         return <XCircle className="h-5 w-5" />;
//       case "REPAID":
//         return <CheckCircle className="h-5 w-5" />;
//       default:
//         return <Clock className="h-5 w-5" />;
//     }
//   };

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount || 0);
//   };

//   const formatDate = (date: Date | string) => {
//     return new Date(date).toLocaleDateString("en-UG", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   };

//   const filteredApplications =
//     filter === "ALL"
//       ? applications
//       : applications.filter((app) => app.status === filter);

//   const stats = {
//     total: applications.length,
//     pending: applications.filter((a) => a.status === "PENDING").length,
//     approved: applications.filter((a) => a.status === "APPROVED").length,
//     disbursed: applications.filter((a) => a.status === "DISBURSED").length,
//     rejected: applications.filter((a) => a.status === "REJECTED").length,
//     totalAmount: applications
//       .filter((a) => a.status === "DISBURSED")
//       .reduce((sum, a) => sum + (a.amountApplied || 0), 0),
//   };

//   const calculateProgress = (application: LoanApplication) => {
//     if (application.status === "PENDING") return 25;
//     if (application.status === "APPROVED") return 50;
//     if (application.status === "DISBURSED") return 100;
//     if (application.status === "REJECTED") return 0;
//     return 0;
//   };

//   const calculateRepaymentProgress = (application: LoanApplication) => {
//     if (!application.loan) return 0;
//     const totalDue = application.loan.totalAmountDue;
//     const outstanding = application.loan.outstandingBalance;
//     const paid = totalDue - outstanding;
//     return Math.round((paid / totalDue) * 100);
//   };

//   return (
//     <div className="space-y-8">
//       {/* Header */}
//       <div className="space-y-2">
//         <h1 className="text-4xl font-bold text-gray-900">Loan Applications</h1>
//         <p className="text-gray-600">
//           Track and manage all your loan applications and repayments
//         </p>
//       </div>

//       {/* Statistics Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
//         <Card className="hover:shadow-lg transition">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm font-medium text-gray-600">
//               Total Applications
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="text-3xl font-bold text-gray-900">
//               {stats.total}
//             </div>
//             <p className="text-xs text-gray-500 mt-2">All time</p>
//           </CardContent>
//         </Card>

//         <Card className="hover:shadow-lg transition">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm font-medium text-yellow-700">
//               Pending
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="text-3xl font-bold text-yellow-600">
//               {stats.pending}
//             </div>
//             <p className="text-xs text-yellow-600 mt-2">Under review</p>
//           </CardContent>
//         </Card>

//         <Card className="hover:shadow-lg transition">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm font-medium text-blue-700">
//               Approved
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="text-3xl font-bold text-blue-600">
//               {stats.approved}
//             </div>
//             <p className="text-xs text-blue-600 mt-2">Awaiting disbursement</p>
//           </CardContent>
//         </Card>

//         <Card className="hover:shadow-lg transition">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm font-medium text-green-700">
//               Active Loans
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="text-3xl font-bold text-green-600">
//               {stats.disbursed}
//             </div>
//             <p className="text-xs text-green-600 mt-2">Being repaid</p>
//           </CardContent>
//         </Card>

//         <Card className="hover:shadow-lg transition">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-sm font-medium text-emerald-700">
//               Total Received
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="text-lg font-bold text-emerald-600 truncate">
//               {formatCurrency(stats.totalAmount)}
//             </div>
//             <p className="text-xs text-emerald-600 mt-2">Disbursed</p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Filter Buttons */}
//       <div className="flex flex-wrap gap-2">
//         {["ALL", "PENDING", "APPROVED", "DISBURSED", "REJECTED"].map(
//           (status) => (
//             <Button
//               key={status}
//               variant={filter === status ? "default" : "outline"}
//               size="sm"
//               onClick={() => setFilter(status)}
//               className="text-sm font-medium"
//             >
//               {status === "ALL" ? "All Applications" : status}
//               {status !== "ALL" && (
//                 <span className="ml-2 text-xs bg-opacity-50 px-2 py-1 rounded">
//                   {stats[status.toLowerCase() as keyof typeof stats] || 0}
//                 </span>
//               )}
//             </Button>
//           )
//         )}
//       </div>

//       {/* Applications List */}
//       <div className="space-y-4">
//         {filteredApplications.length === 0 ? (
//           <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-dashed">
//             <CardContent className="pt-16 pb-16 text-center">
//               <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
//               <h3 className="text-lg font-semibold text-gray-900 mb-2">
//                 No applications found
//               </h3>
//               <p className="text-gray-600 mb-6">
//                 {filter === "ALL"
//                   ? "You have not submitted any loan applications yet."
//                   : `You have no ${filter.toLowerCase()} applications.`}
//               </p>
//               <Button
//                 onClick={() => router.push("/dashboard/loan-applications")}
//                 className="gap-2"
//               >
//                 <ArrowRight className="h-4 w-4" />
//                 Apply for a Loan
//               </Button>
//             </CardContent>
//           </Card>
//         ) : (
//           filteredApplications.map((application) => {
//             const statusInfo = getStatusInfo(application.status);
//             const isExpanded = expandedId === application.id;
//             const progress = calculateProgress(application);
//             const repaymentProgress = calculateRepaymentProgress(application);

//             return (
//               <Card
//                 key={application.id}
//                 className={`hover:shadow-lg transition border-l-4 cursor-pointer ${statusInfo.borderColor}`}
//                 onClick={() =>
//                   setExpandedId(isExpanded ? null : application.id)
//                 }
//               >
//                 <CardHeader className="pb-3">
//                   <div className="space-y-3">
//                     <div className="flex items-start justify-between gap-4">
//                       <div className="flex items-center gap-3 flex-1 min-w-0">
//                         <div className={`p-3 rounded-lg ${statusInfo.bgColor}`}>
//                           <CreditCard className="h-5 w-5 text-blue-600" />
//                         </div>
//                         <div className="flex-1 min-w-0">
//                           <h3 className="font-semibold text-gray-900 truncate">
//                             {application.loanProduct?.name}
//                           </h3>
//                           <p className="text-sm text-gray-500">
//                             App ID: {application.id.slice(0, 12)}
//                           </p>
//                         </div>
//                       </div>
//                       <Badge
//                         className={`${statusInfo.color} ${statusInfo.bgColor} border ${statusInfo.borderColor} flex items-center gap-1 px-3 py-1 whitespace-nowrap`}
//                       >
//                         {getStatusIcon(application.status)}
//                         {statusInfo.label}
//                       </Badge>
//                     </div>

//                     {/* Progress Bar */}
//                     <div className="space-y-1">
//                       <div className="flex justify-between items-center text-xs">
//                         <span className="text-gray-600">Application Progress</span>
//                         <span className="font-medium text-gray-900">
//                           {progress}%
//                         </span>
//                       </div>
//                       <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
//                         <div
//                           className={`h-full transition-all duration-300 ${
//                             application.status === "REJECTED"
//                               ? "bg-red-500"
//                               : application.status === "PENDING"
//                               ? "bg-yellow-500"
//                               : application.status === "APPROVED"
//                               ? "bg-blue-500"
//                               : "bg-green-500"
//                           }`}
//                           style={{ width: `${progress}%` }}
//                         />
//                       </div>
//                     </div>
//                   </div>
//                 </CardHeader>

//                 <CardContent className={`space-y-4 ${isExpanded ? "block" : "hidden"}`}>
//                   {/* Status Description */}
//                   <p className={`text-sm ${statusInfo.color} ${statusInfo.bgColor} p-3 rounded-lg border ${statusInfo.borderColor}`}>
//                     {statusInfo.description}
//                   </p>

//                   {/* Main Details Grid */}
//                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                     <div className="space-y-1">
//                       <label className="text-xs font-medium text-gray-500 uppercase">
//                         Amount Applied
//                       </label>
//                       <div className="flex items-center gap-2">
//                         <DollarSign className="h-4 w-4 text-green-600" />
//                         <span className="text-lg font-semibold text-green-600">
//                           {formatCurrency(application.amountApplied)}
//                         </span>
//                       </div>
//                     </div>

//                     {application.loan && (
//                       <div className="space-y-1">
//                         <label className="text-xs font-medium text-gray-500 uppercase">
//                           Amount Granted
//                         </label>
//                         <div className="flex items-center gap-2">
//                           <TrendingUp className="h-4 w-4 text-blue-600" />
//                           <span className="text-lg font-semibold text-blue-600">
//                             {formatCurrency(application.loan.amountGranted)}
//                           </span>
//                         </div>
//                       </div>
//                     )}

//                     <div className="space-y-1">
//                       <label className="text-xs font-medium text-gray-500 uppercase">
//                         Interest Rate
//                       </label>
//                       <div className="text-lg font-semibold text-gray-900">
//                         {application.loanProduct?.interestRate}% p.a.
//                       </div>
//                     </div>
//                   </div>

//                   {/* Dates */}
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
//                     <div className="space-y-1">
//                       <label className="text-xs font-medium text-gray-500 uppercase">
//                         Applied On
//                       </label>
//                       <div className="flex items-center gap-2">
//                         <Calendar className="h-4 w-4 text-gray-400" />
//                         <span className="text-sm text-gray-900">
//                           {formatDate(application.applicationDate)}
//                         </span>
//                       </div>
//                     </div>

//                     {application.approvalDate && (
//                       <div className="space-y-1">
//                         <label className="text-xs font-medium text-gray-500 uppercase">
//                           {application.status === "REJECTED"
//                             ? "Decision Date"
//                             : "Decision Date"}
//                         </label>
//                         <div className="flex items-center gap-2">
//                           <Calendar className="h-4 w-4 text-gray-400" />
//                           <span className="text-sm text-gray-900">
//                             {formatDate(application.approvalDate)}
//                           </span>
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   {/* Loan Details */}
//                   {application.loan && (
//                     <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg space-y-4 border border-green-200">
//                       <h4 className="font-semibold text-gray-900 flex items-center gap-2">
//                         <CheckCircle className="h-5 w-5 text-green-600" />
//                         Loan Details & Repayment Status
//                       </h4>

//                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
//                         <div className="bg-white p-3 rounded border border-green-100">
//                           <span className="text-gray-600 text-xs">Total Due</span>
//                           <p className="font-semibold text-red-600 mt-1">
//                             {formatCurrency(application.loan.totalAmountDue)}
//                           </p>
//                         </div>
//                         <div className="bg-white p-3 rounded border border-orange-100">
//                           <span className="text-gray-600 text-xs">Outstanding</span>
//                           <p className="font-semibold text-orange-600 mt-1">
//                             {formatCurrency(
//                               application.loan.outstandingBalance
//                             )}
//                           </p>
//                         </div>
//                         <div className="bg-white p-3 rounded border border-blue-100">
//                           <span className="text-gray-600 text-xs">Due Date</span>
//                           <p className="font-semibold text-blue-600 mt-1">
//                             {formatDate(application.loan.dueDate)}
//                           </p>
//                         </div>
//                       </div>

//                       {/* Repayment Progress */}
//                       <div className="space-y-2">
//                         <div className="flex justify-between items-center text-sm">
//                           <span className="text-gray-700 font-medium">Repayment Progress</span>
//                           <span className="font-semibold text-gray-900">
//                             {repaymentProgress}%
//                           </span>
//                         </div>
//                         <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
//                           <div
//                             className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-300"
//                             style={{ width: `${repaymentProgress}%` }}
//                           />
//                         </div>
//                         <p className="text-xs text-gray-600">
//                           Repayment Period: {application.loanProduct?.repaymentPeriodDays} days ({Math.round(application.loanProduct?.repaymentPeriodDays / 30)} months)
//                         </p>
//                       </div>
//                     </div>
//                   )}

//                   {/* Purpose */}
//                   {application.purpose && (
//                     <div className="pt-2 border-t">
//                       <label className="text-xs font-medium text-gray-500 uppercase">
//                         Purpose
//                       </label>
//                       <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded">
//                         {application.purpose}
//                       </p>
//                     </div>
//                   )}

//                   {/* Rejection Reason */}
//                   {application.rejectionReason && (
//                     <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
//                       <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
//                       <div>
//                         <h4 className="font-semibold text-red-900">
//                           Reason for Rejection
//                         </h4>
//                         <p className="text-sm text-red-700 mt-2">
//                           {application.rejectionReason}
//                         </p>
//                       </div>
//                     </div>
//                   )}

//                   {/* Action Buttons */}
//                   <div className="pt-4 flex flex-wrap gap-2 justify-end border-t">
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                       }}
//                     >
//                       <Download className="h-4 w-4 mr-2" />
//                       Download
//                     </Button>
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                       }}
//                     >
//                       <Share2 className="h-4 w-4 mr-2" />
//                       Share
//                     </Button>
//                     <Button
//                       size="sm"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         router.push(
//                           `/dashboard/loan-applications/${application.id}`
//                         );
//                       }}
//                     >
//                       <Eye className="h-4 w-4 mr-2" />
//                       Full Details
//                     </Button>
//                   </div>
//                 </CardContent>
//               </Card>
//             );
//           })
//         )}
//       </div>
//     </div>
//   );
// };
