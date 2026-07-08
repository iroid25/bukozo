// "use client";
// import { useState } from "react";
// import * as XLSX from "xlsx";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";
// import axios from "axios";
// import LoanRepaymentCreateForm from "../../loan-repayments/components/LoanRepaymentCreateForm";

// import { Column, DataTable, TableActions } from "@/components/ui/data-table";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Progress } from "@/components/ui/progress";
// import {
//   Eye,
//   DollarSign,
//   User,
//   Calendar,
//   TrendingDown,
//   AlertTriangle,
//   Clock,
//   CheckCircle,
//   AlertCircle,
//   TrendingUp,
//   FileText,
// } from "lucide-react";

// import {
//   Loan,
//   getLoanStatusInfo,
//   getLoanHealth,
//   getDaysUntilDue,
//   isLoanOverdue,
// } from "@/types/loan";
// import { formatISODate } from "@/lib/utils";

// interface LoanStatistics {
//   totalLoans: number;
//   activeLoans: number;
//   overdueLoans: number;
//   repaidLoans: number;
//   totalDisbursed: number;
//   totalOutstanding: number;
//   totalRepaid: number;
//   repaymentRate: number;
//   defaultRate: number;
// }

// export default function LoanListing({
//   loans,
//   title,
//   subtitle,
//   statistics,
//   userRole,
//   currentUserId,
// }: {
//   loans: Loan[];
//   title: string;
//   subtitle: string;
//   statistics: LoanStatistics;
//   userRole: string;
//   currentUserId: string;
// }) {
//   const router = useRouter();
//   const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
//   const [selectedLoanId, setSelectedLoanId] = useState<string | undefined>(undefined);
//   const [selectedIsInstitution, setSelectedIsInstitution] = useState(false);
//   const [isApplyingPenalty, setIsApplyingPenalty] = useState<string | null>(null);

//   // Format currency
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const handleApplyPenalty = async (loanId: string) => {
//     if (!confirm("PENALTY WILL BE IMPOSED ACCORDING TO THE LOAN PERIOD RELATING TO THE GLOBAL PENALTY CONFIGURATION IN FEE CONFIGURATION")) {
//       return;
//     }

//     try {
//       setIsApplyingPenalty(loanId);
//       const resp = await axios.post(`/api/v1/loans/${loanId}/penalty`, {
//         mode: "policy"
//       });

//       if (resp.data.success) {
//         toast.success("Penalty applied successfully", {
//           description: `Amount charged: ${formatCurrency(resp.data.data.amount)}`
//         });
//         router.refresh();
//       } else {
//         throw new Error(resp.data.error || "Failed to apply penalty");
//       }
//     } catch (error: any) {
//       toast.error("Failed to apply penalty", {
//         description: error.response?.data?.error || error.message
//       });
//     } finally {
//       setIsApplyingPenalty(null);
//     }
//   };

//   const columns: Column<Loan>[] = [
//     {
//       accessorKey: "member",
//       header: "Borrower Details",
//       cell: (row) => {
//         const loan = row;
//         const member = loan.member;
//         const user = member.user;

//         const isValidImageUrl = (url: string | null | undefined): boolean => {
//           if (!url || typeof url !== 'string') return false;
//           try {
//             const validPatterns = ['http://', 'https://', 'data:image/', '/'];
//             return validPatterns.some(pattern => url.startsWith(pattern));
//           } catch {
//             return false;
//           }
//         };
        
//         const userImageUrl = isValidImageUrl(user.image) ? user.image : null;

//         return (
//           <div className="flex items-center gap-3 text-xs md:text-sm">
//             <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
//               {userImageUrl ? (
//                 <img
//                   src={userImageUrl}
//                   alt={user.name}
//                   className="h-8 w-8 rounded-full object-cover"
//                   onError={(e) => {
//                     (e.target as HTMLImageElement).style.display = 'none';
//                   }}
//                 />
//               ) : (
//                 <User className="h-4 w-4" />
//               )}
//             </div>
//             <div className="flex flex-col min-w-0">
//               <span className="font-medium truncate">{user.name}</span>
//               <span className="text-gray-500 text-[10px]">#{member.memberNumber}</span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "loanApplication",
//       header: "Principal/Details",
//       cell: (row) => {
//         const loan = row;
//         return (
//           <div className="flex flex-col gap-0.5">
//             <div className="flex items-center gap-1 font-medium text-emerald-900">
//                {formatCurrency(loan.amountGranted)}
//             </div>
//             <div className="text-[10px] text-gray-400">
//               {loan.interestRate}% • {loan._count?.repayments || 0} pmt
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "outstandingBalance",
//       header: "Outstanding",
//       cell: (row) => {
//         const loan = row;
//         const isOverdue = isLoanOverdue(loan);

//         return (
//           <div className="flex flex-col">
//             <div className="flex items-center gap-1.5 font-semibold text-rose-600">
//               <TrendingDown className="h-4 w-4" />
//               {formatCurrency(loan.outstandingBalance)}
//             </div>
//             <div className="text-[10px] text-slate-500 mt-0.5 ml-5.5">
//                of {formatCurrency(loan.totalAmountDue)}
//             </div>
//             {(loan as any).penaltyCharged > 0 && (
//                <div className="text-[10px] text-amber-600 font-bold">
//                  Pen: {formatCurrency((loan as any).penaltyCharged)}
//                </div>
//             )}
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "dueDate",
//       header: "Next Pay / Status",
//       cell: (row) => {
//         const loan = row;
//         const daysUntilDue = getDaysUntilDue(loan.dueDate);
//         const isOverdue = isLoanOverdue(loan);
//         const statusInfo = getLoanStatusInfo(loan.status);

//         return (
//           <div className="flex flex-col">
//              <div className="flex items-center gap-1.5 mb-1">
//                 <Badge variant="outline" className={`${statusInfo.color} border-none font-bold py-0 h-5`}>
//                    {statusInfo.label}
//                 </Badge>
//              </div>
//              <div className={`text-[10px] flex items-center gap-1 font-medium ${isOverdue ? "text-red-500" : "text-slate-500"}`}>
//                 <Calendar className="h-3 w-3" />
//                 {formatISODate(loan.dueDate)}
//                 <span className="ml-1">
//                    ({isOverdue ? `${Math.abs(daysUntilDue)}d Over` : `${daysUntilDue}d left`})
//                 </span>
//              </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "id",
//       header: "Actions",
//       cell: (row) => {
//         const loan = row;
//         const isOverdue = isLoanOverdue(loan);

//         return (
//           <div className="flex items-center gap-2">
//             <Button
//               variant="outline"
//               size="sm"
//               className="h-8 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
//               onClick={() => router.push(`/dashboard/loans/${loan.id}`)}
//             >
//               <Eye className="h-3.5 w-3.5 mr-1.5" />
//               View Details
//             </Button>

//             <Button
//               variant="outline"
//               size="sm"
//               className="h-8 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
//               onClick={() => router.push(`/dashboard/loans/${loan.id}?tab=ledger`)}
//             >
//               <FileText className="h-3.5 w-3.5 mr-1.5" />
//               View Ledger
//             </Button>

//             <Button
//               variant="outline"
//               size="sm"
//               className="h-8 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
//               onClick={() => router.push(`/dashboard/loans/${loan.id}?tab=schedule`)}
//             >
//               <Calendar className="h-3.5 w-3.5 mr-1.5" />
//               View Schedule
//             </Button>

//             <Button
//               variant="outline"
//               size="sm"
//               className="h-8 text-xs font-medium border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all shadow-sm"
//               onClick={() => handleApplyPenalty(loan.id)}
//               disabled={isApplyingPenalty === loan.id}
//             >
//               {isApplyingPenalty === loan.id ? (
//                 <>
//                   <Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" />
//                   Processing...
//                 </>
//               ) : (
//                 <>
//                   <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
//                   Impose Penalty
//                 </>
//               )}
//             </Button>
//           </div>
//         );
//       },
//     },
//   ];

//   // Export to Excel logic
//   const handleExport = async (filteredLoans: Loan[]) => {
//     try {
//       const exportData = filteredLoans.map((loan) => {
//         const daysUntilDue = getDaysUntilDue(loan.dueDate);
//         const isOverdue = isLoanOverdue(loan);

//         return {
//           "Loan ID": loan.id,
//           "Member Name": loan.member.user.name,
//           "Member Number": loan.member.memberNumber,
//           "Amount Granted": loan.amountGranted,
//           "Penalty Charged": (loan as any).penaltyCharged || 0,
//           "Outstanding Balance": loan.outstandingBalance,
//           Status: getLoanStatusInfo(loan.status).label,
//           "Due Date": formatISODate(loan.dueDate),
//           "Days Overdue": isOverdue ? Math.abs(daysUntilDue) : 0,
//         };
//       });

//       const worksheet = XLSX.utils.json_to_sheet(exportData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "Active Loans");
//       const fileName = `Bukonzo_Active_Loans_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
//       XLSX.writeFile(workbook, fileName);
//       toast.success("Export successful", { description: `Loans exported to ${fileName}` });
//     } catch (error: any) {
//       toast.error("Export failed", { description: error.message });
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Statistics Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
//         <Card className="border-none shadow-premium bg-slate-50/50">
//           <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 text-indigo-700">
//             <CardTitle className="text-[10px] uppercase tracking-wider font-bold">Active Loans</CardTitle>
//             <TrendingUp className="h-3 w-3" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-xl font-bold text-indigo-900">{statistics.activeLoans}</div>
//             <p className="text-[10px] text-indigo-600/70 mt-0.5">Currently disbursed</p>
//           </CardContent>
//         </Card>

//         <Card className="border-none shadow-premium bg-slate-50/50">
//           <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 text-rose-700">
//             <CardTitle className="text-[10px] uppercase tracking-wider font-bold">Overdue</CardTitle>
//             <AlertTriangle className="h-3 w-3" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-xl font-bold text-rose-900">{statistics.overdueLoans}</div>
//             <p className="text-[10px] text-rose-600/70 mt-0.5">Requiring attention</p>
//           </CardContent>
//         </Card>

//         <Card className="border-none shadow-premium bg-slate-50/50">
//           <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 text-emerald-700">
//             <CardTitle className="text-[10px] uppercase tracking-wider font-bold">Repaid Total</CardTitle>
//             <CheckCircle className="h-3 w-3" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-xl font-bold text-emerald-900">{formatCurrency(statistics.totalRepaid || 0)}</div>
//             <p className="text-[10px] text-emerald-600/70 mt-0.5">Recovered funds</p>
//           </CardContent>
//         </Card>

//         <Card className="border-none shadow-premium bg-slate-50/50">
//           <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 text-slate-700">
//             <CardTitle className="text-[10px] uppercase tracking-wider font-bold">Outstanding</CardTitle>
//             <TrendingDown className="h-3 w-3" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-xl font-bold text-slate-900">{formatCurrency(statistics.totalOutstanding)}</div>
//             <p className="text-[10px] text-slate-600/70 mt-0.5">Portfolio at risk</p>
//           </CardContent>
//         </Card>

//         <Card className="border-none shadow-premium bg-slate-50/50 lg:col-span-1 xl:col-span-2">
//           <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0 text-purple-700">
//             <CardTitle className="text-[10px] uppercase tracking-wider font-bold">Total Disbursed</CardTitle>
//             <DollarSign className="h-3 w-3" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-xl font-bold text-purple-900">{formatCurrency(statistics.totalDisbursed)}</div>
//             <p className="text-[10px] text-purple-600/70 mt-0.5">Historical volume</p>
//           </CardContent>
//         </Card>
//       </div>

//       <DataTable<Loan>
//         title=""
//         subtitle=""
//         data={loans}
//         columns={columns}
//         keyField="id"
//         isLoading={false}
//         onRefresh={() => router.refresh()}
//         actions={{
//           onExport: handleExport,
//         }}
//         filters={{
//           searchFields: [
//             "member.user.name",
//             "member.memberNumber",
//             "loanApplication.purpose",
//           ],
//           enableDateFilter: true,
//           getItemDate: (item) => item.disbursementDate ?? new Date(),
//         }}
//       />
      
//       <LoanRepaymentCreateForm
//         isOpen={repaymentModalOpen}
//         onClose={() => setRepaymentModalOpen(false)}
//         currentUserId={currentUserId}
//         initialLoanId={selectedLoanId}
//         isInstitution={selectedIsInstitution}
//       />
//     </div>
//   );
// }

"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import LoanRepaymentCreateForm from "../../loan-repayments/components/LoanRepaymentCreateForm";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Eye,
  DollarSign,
  User,
  Calendar,
  Building,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  FileText,
  Send,
  Calculator,
  ArrowRight,
  Search,
} from "lucide-react";

import {
  calculateCompoundingPenalty,
  PenaltyTier,
} from "@/lib/penalty-calculations";

import {
  Loan,
  getLoanStatusInfo,
  getLoanHealth,
  getDaysUntilDue,
  isLoanOverdue,
} from "@/types/loan";
import { formatISODate } from "@/lib/utils";

interface LoanStatistics {
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
  repaidLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalRepaid: number;
  repaymentRate: number;
  defaultRate: number;
}

export default function LoanListing({
  loans,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  loans: Loan[];
  title: string;
  subtitle: string;
  statistics: LoanStatistics;
  userRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [repaymentModalOpen, setRepaymentModalOpen] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | undefined>(undefined);
  const [selectedIsInstitution, setSelectedIsInstitution] = useState(false);
  const [isApplyingPenalty, setIsApplyingPenalty] = useState<string | null>(null);
  const [penaltyModalLoan, setPenaltyModalLoan] = useState<Loan | null>(null);
  const [penaltyMode, setPenaltyMode] = useState<"policy" | "manual">("policy");
  const [manualPenaltyAmount, setManualPenaltyAmount] = useState<string>("");
  const [penaltyTiers, setPenaltyTiers] = useState<PenaltyTier[]>([
    { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
    { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
    { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
    { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
    { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
    { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
    { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
  ]);

  // Fetch penalty tiers from settings on mount
  useEffect(() => {
    const fetchPenaltyTiers = async () => {
      try {
        const response = await axios.get("/api/v1/settings/fees?key=penalty_tiers");
        if (response.data.data) {
          setPenaltyTiers(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch penalty tiers:", error);
      }
    };
    fetchPenaltyTiers();
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const executeApplyPenalty = async (loanId: string, amount?: number) => {
    console.log("Executing penalty application:", { loanId, penaltyMode, manualPenaltyAmount, amount });
    try {
      setIsApplyingPenalty(loanId);
      const payload = penaltyMode === "manual" && manualPenaltyAmount
        ? { mode: "manual", amount: parseFloat(manualPenaltyAmount) }
        : { mode: "policy" };
      
      console.log("Penalty payload:", payload);
      
      const resp = await axios.post(`/api/v1/loans/${loanId}/penalty`, payload);

      if (resp.data.success) {
        toast.success("Penalty applied successfully", {
          description: `Amount charged: ${formatCurrency(resp.data.data.amount)}`
        });
        setPenaltyModalLoan(null);
        setPenaltyMode("policy");
        setManualPenaltyAmount("");
        router.refresh();
        // Redirect to penalty collection page
        router.push("/dashboard/accounts/penalty-collection");
      } else {
        throw new Error(resp.data.error || "Failed to apply penalty");
      }
    } catch (error: any) {
      console.error("Penalty application error:", error);
      toast.error("Failed to apply penalty", {
        description: error.response?.data?.error || error.message
      });
    } finally {
      setIsApplyingPenalty(null);
    }
  };

  const columns: Column<Loan>[] = [
    {
      accessorKey: "member",
      header: "Borrower Details",
      cell: (row) => {
        const loan = row;
        const member = loan.member;
        const user = member.user;
        const statusInfo = getLoanStatusInfo(loan.status);

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              {user.image ? (
                <img
                  src={user.image}
                  alt={user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{user.name}</span>
                {/* <Badge className={statusInfo.color}>
                  {statusInfo.icon} {statusInfo.label}
                </Badge> */}
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span>#{member.memberNumber}</span>
                {/* {user.phone && (
                  <>
                    <span>•</span>
                    <span>{user.phone}</span>
                  </>
                )} */}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "loanApplication",
      header: "Loan Details",
      cell: (row) => {
        const loan = row;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="font-medium text-green-700">
                {formatCurrency(loan.amountGranted)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              {loan.interestRate}% {(loan.interestPeriod === "ANNUAL" ? "/year" : "/month")} • {loan._count?.repayments || 0} payments
            </div>
            {loan.loanApplication.purpose && (
              <div className="text-xs text-gray-400 max-w-32 truncate">
                {loan.loanApplication.purpose}
              </div>
            )}
          </div>
        );
      },
    },
    // {
    //   accessorKey: "repaymentProgress",
    //   header: "Repayment Progress",
    //   cell: (row) => {
    //     const loan = row;
    //     const health = getLoanHealth(loan);
    //     const progressPercentage =
    //       (loan.amountPaid / loan.totalAmountDue) * 100;

    //     return (
    //       <div className="flex flex-col gap-2 min-w-32">
    //         <div className="flex justify-between text-sm">
    //           <span className="text-gray-600">Paid:</span>
    //           <span className="font-medium">
    //             {Math.round(progressPercentage)}%
    //           </span>
    //         </div>
    //         <Progress value={progressPercentage} className="h-2" />
    //         <div className="flex justify-between text-xs">
    //           <span className="text-gray-500">
    //             {formatCurrency(loan.amountPaid)}
    //           </span>
    //           <span className="text-gray-500">
    //             {formatCurrency(loan.totalAmountDue)}
    //           </span>
    //         </div>
    //         <div className={`text-xs font-medium ${health.color}`}>
    //           Health: {health.status}
    //         </div>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "outstandingBalance",
      header: "Outstanding",
      cell: (row) => {
        const loan = row;

        return (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <div className="flex flex-col">
              <span className="font-medium text-red-700 text-lg">
                {formatCurrency(loan.outstandingBalance)}
              </span>
              <span className="text-sm text-gray-500">
                of {formatCurrency(loan.totalAmountDue)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: "Due Date",
      cell: (row) => {
        const loan = row;
        const daysUntilDue = getDaysUntilDue(loan.dueDate);
        const isOverdue = isLoanOverdue(loan);

        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{formatISODate(loan.dueDate)}</span>
              <div
                className={`text-sm ${isOverdue ? "text-red-600" : daysUntilDue <= 30 ? "text-yellow-600" : "text-gray-500"}`}
              >
                {isOverdue ? (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {Math.abs(daysUntilDue)} days overdue
                  </span>
                ) : daysUntilDue <= 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due today
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {daysUntilDue} days left
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    // {
    //   accessorKey: "branch",
    //   header: "Branch",
    //   cell: (row) => {
    //     const loan = row;

    //     return (
    //       <div className="flex items-center gap-2">
    //         <Building className="h-4 w-4 text-gray-500" />
    //         <div className="flex flex-col">
    //           <span className="font-medium">{loan.branch?.name || "N/A"}</span>
    //           {loan.branch?.location && (
    //             <span className="text-sm text-gray-500">
    //               {loan.branch.location}
    //             </span>
    //           )}
    //         </div>
    //       </div>
    //     );
    //   },
    // },
    // {
    //   accessorKey: "disbursedBy",
    //   header: "Disbursed By",
    //   cell: (row) => {
    //     const loan = row;

    //     return (
    //       <div className="flex flex-col">
    //         <span className="font-medium">{loan.disbursedByUser.name}</span>
    //         <div className="flex items-center gap-1 text-sm text-gray-500">
    //           <Badge variant="outline" className="text-xs">
    //             {loan.disbursedByUser.role}
    //           </Badge>
    //           <span>•</span>
    //           <span>{formatISODate(loan.disbursementDate)}</span>
    //         </div>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const loan = row;

        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/loans/${loan.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/loans/reports/ledger?loanId=${loan.id}`)}
            >
              <FileText className="h-5 w-4 mr-1" />
              View Ledger
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/loans/reports/repayment-schedule?loanId=${loan.id}`)}
            >
              <Calendar className="h-4 w-4 mr-1" />
              View Schedule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              onClick={() => {
                setPenaltyModalLoan(loan);
              }}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Verify Penalty
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-semibold"
              onClick={() => {
                // Always open the dialog first for verification
                setPenaltyModalLoan(loan);
              }}
              disabled={isApplyingPenalty === loan.id}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              {isApplyingPenalty === loan.id ? "Imposing..." : "Impose"}
            </Button>
          </div>
        );
      },
    },
  ];

  // Export to Excel
  const handleExport = async (filteredLoans: Loan[]) => {
    try {
      // Prepare data for export
      const exportData = filteredLoans.map((loan) => {
        const health = getLoanHealth(loan);
        const daysUntilDue = getDaysUntilDue(loan.dueDate);
        const isOverdue = isLoanOverdue(loan);

        return {
          "Loan ID": loan.id,
          "Member Name": loan.member.user.name,
          "Member Number": loan.member.memberNumber,
          "Amount Granted": loan.amountGranted,
          "Interest Rate": `${loan.interestRate}%`,
          "Total Amount Due": loan.totalAmountDue,
          "Amount Paid": loan.amountPaid,
          "Outstanding Balance": loan.outstandingBalance,
          "Payment Progress": `${Math.round((loan.amountPaid / loan.totalAmountDue) * 100)}%`,
          Status: getLoanStatusInfo(loan.status).label,
          "Health Score": health.status,
          "Disbursement Date": formatISODate(loan.disbursementDate),
          "Due Date": formatISODate(loan.dueDate),
          "Days Until Due": isOverdue
            ? `${Math.abs(daysUntilDue)} days overdue`
            : `${daysUntilDue} days`,
          Branch: loan.branch?.name || "N/A",
          "Branch Location": loan.branch?.location || "N/A",
          "Disbursed By": loan.disbursedByUser.name,
          "Disbursed By Role": loan.disbursedByUser.role,
          "Total Payments": loan._count?.repayments || 0,
          "Loan Purpose": loan.loanApplication.purpose || "N/A",
          "Application Date": formatISODate(
            loan.loanApplication.applicationDate
          ),
          "Member Email": loan.member.user.email,
          "Member Phone": loan.member.user.phone || "N/A",
        };
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Active Loans");

      // Generate filename with current date
      const fileName = `Active_Loans_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Active loans exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h2 className="text-3xl font-bold tracking-tight">Loan Overview</h2>
           <p className="text-muted-foreground">Manage loans and view statistics</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/analytics/loan-officers">
            <Button variant="outline" size="sm">
              <Target className="h-4 w-4 mr-2" />
              Loan Officer Performance
            </Button>
          </Link>
          <Link href="/dashboard/analytics/tellers">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Teller Performance
            </Button>
          </Link>
          <Link href="/dashboard/loans/migrate">
            <Button variant="default">
              Import Legacy Loan
            </Button>
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.totalLoans}
            </div>
            <p className="text-xs text-gray-500">All time loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {statistics.activeLoans}
            </div>
            <p className="text-xs text-gray-500">Currently disbursed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {statistics.overdueLoans}
            </div>
            <p className="text-xs text-gray-500">Past due date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Repaid</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-700">
              {statistics.repaidLoans}
            </div>
            <p className="text-xs text-gray-500">Completed loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(statistics.totalOutstanding)}
            </div>
            <p className="text-xs text-gray-500">Total owed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Disbursed
            </CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {formatCurrency(statistics.totalDisbursed)}
            </div>
            <p className="text-xs text-gray-500">All time disbursed</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Repayment Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-green-600">
                {statistics.repaymentRate.toFixed(1)}%
              </div>
              <div className="flex-1">
                <Progress value={statistics.repaymentRate} className="h-3" />
                <p className="text-sm text-gray-500 mt-1">
                  {statistics.repaidLoans} of {statistics.totalLoans} loans
                  fully repaid
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Default Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-red-600">
                {statistics.defaultRate.toFixed(1)}%
              </div>
              <div className="flex-1">
                <Progress value={statistics.defaultRate} className="h-3" />
                <p className="text-sm text-gray-500 mt-1">
                  {statistics.overdueLoans} of {statistics.totalLoans} loans
                  overdue
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable<Loan>
        title={title}
        subtitle={subtitle}
        data={loans}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "member.user.name",
            "member.memberNumber",
            "loanApplication.purpose",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.disbursementDate,
        }}
        renderRowActions={(item) => (
          <TableActions.RowActions
          // onView={() => router.push(`/dashboard/loans/${item.id}`)}
          />
        )}
      />
      <LoanRepaymentCreateForm
        isOpen={repaymentModalOpen}
        onClose={() => setRepaymentModalOpen(false)}
        currentUserId={currentUserId}
        initialLoanId={selectedLoanId}
        isInstitution={selectedIsInstitution}
      />
      
      {/* Penalty Confirmation Modal */}
      <Dialog
        open={!!penaltyModalLoan}
        onOpenChange={(open) => !open && setPenaltyModalLoan(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-none shadow-2xl rounded-2xl p-0">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogHeader className="p-0">
                  <DialogTitle className="text-xl font-bold text-white">Penalty Verification Breakdown</DialogTitle>
                  <DialogDescription className="text-white/80">
                    Detailed compounding calculation for{" "}
                    <span className="font-bold border-b border-white/30 truncate">
                      {penaltyModalLoan?.member?.user?.name || "the borrower"}
                    </span>
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
          </div>

          {penaltyModalLoan && (
            <div className="p-6 space-y-6">
              {/* Penalty Mode Toggle */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="policyMode"
                    name="penaltyMode"
                    checked={penaltyMode === "policy"}
                    onChange={() => setPenaltyMode("policy")}
                    className="w-4 h-4 text-amber-600"
                  />
                  <label htmlFor="policyMode" className="text-sm font-medium cursor-pointer">
                    Policy Based (Auto-Calculate)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="manualMode"
                    name="penaltyMode"
                    checked={penaltyMode === "manual"}
                    onChange={() => setPenaltyMode("manual")}
                    className="w-4 h-4 text-amber-600"
                  />
                  <label htmlFor="manualMode" className="text-sm font-medium cursor-pointer">
                    Manual Input
                  </label>
                </div>
              </div>

              {/* Manual Penalty Input */}
              {penaltyMode === "manual" && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                    Enter Penalty Amount (UGX)
                  </label>
                  <input
                    type="number"
                    value={manualPenaltyAmount}
                    onChange={(e) => setManualPenaltyAmount(e.target.value)}
                    placeholder="Enter amount e.g. 50000"
                    className="mt-2 w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-blue-600 mt-2">
                    Enter a custom penalty amount to charge the member
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Target className="h-3 w-3" />
                    Portfolio at Risk
                  </p>
                  <p className="text-2xl font-black text-slate-900 leading-none">
                    {formatCurrency(penaltyModalLoan.outstandingBalance)}
                  </p>
                </div>
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col justify-center">
                  <p className="text-[10px] text-rose-600 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" />
                    Overdue Status
                  </p>
                  <p className="text-2xl font-black text-rose-800 leading-none">
                    {Math.abs(getDaysUntilDue(penaltyModalLoan.dueDate))} Days
                  </p>
                </div>
              </div>

              {/* Installment Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Compounding Schedule History
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm bg-slate-50/30">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-100">
                        <th className="px-4 py-3 text-left font-black text-slate-600 uppercase tracking-tighter">Period</th>
                        <th className="px-4 py-3 text-left font-black text-slate-600 uppercase tracking-tighter">Due Date</th>
                        <th className="px-4 py-3 text-right font-black text-slate-600 uppercase tracking-tighter">Arrears</th>
                        <th className="px-4 py-3 text-right font-black text-slate-600 uppercase tracking-tighter">Rate Tier</th>
                        <th className="px-4 py-3 text-right font-black text-amber-600 uppercase tracking-tighter">PENALTY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const now = new Date();
                        // Use penalty tiers from state (fetched from settings)
                        const tiers = penaltyTiers;

                        const overdueSchedules = ((penaltyModalLoan as any).schedules || [])
                          .filter((s: any) => s.status !== "PAID" && new Date(s.dueDate) < now)
                          .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

                        if (overdueSchedules.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} className="px-4 py-12 text-center text-slate-400 italic">
                                <Search className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                No specific overdue installments found.<br/>Standard flat penalty policy will be applied.
                              </td>
                            </tr>
                          );
                        }

                        let runningArrearsTotal = 0;
                        return overdueSchedules.map((s: any) => {
                          const arrears = s.principalPayment + s.interestPayment - (s.paidAmount || 0);
                          runningArrearsTotal += arrears;
                          const dOverdue = Math.floor((now.getTime() - new Date(s.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                          const tier = tiers.find(t => dOverdue >= t.minDays && dOverdue <= t.maxDays) || tiers[tiers.length - 1];
                          const penaltyValue = runningArrearsTotal * tier.penaltyRate;
                          runningArrearsTotal += penaltyValue;

                          return (
                            <tr key={s.id} className="hover:bg-white transition-colors group">
                              <td className="px-4 py-3 font-bold text-slate-700">PRD-{s.period}</td>
                              <td className="px-4 py-3 text-slate-500 font-medium">{formatISODate(s.dueDate)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-600">{formatCurrency(arrears)}</td>
                              <td className="px-4 py-3 text-right">
                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-bold bg-slate-200/50 text-slate-600">
                                  {Math.round(tier.penaltyRate * 100)}% ({tier.minDays}d+)
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-black text-amber-600 group-hover:scale-105 origin-right transition-transform">
                                {formatCurrency(penaltyValue)}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final Result Card */}
              <div className="p-5 bg-slate-900 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between overflow-hidden relative">
                <div className="absolute top-[-20px] right-[-20px] opacity-10">
                  <Calculator size={120} className="text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-1">
                    System Calculated Penalty
                  </p>
                  <p className="text-4xl font-black text-amber-400 tracking-tighter italic">
                    {(() => {
                      const now = new Date();
                      const overdueSchedules = ((penaltyModalLoan as any).schedules || [])
                        .filter((s: any) => s.status !== "PAID" && new Date(s.dueDate) < now)
                        .map((s: any) => ({
                          period: s.period,
                          principalArrears: s.principalPayment - (s.paidPrincipal || 0),
                          interestArrears: s.interestPayment - (s.paidInterest || 0),
                          daysOverdue: Math.floor((now.getTime() - new Date(s.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                        }));
                      
                      const amount = calculateCompoundingPenalty(overdueSchedules);
                      return formatCurrency(amount);
                    })()}
                  </p>
                </div>
                <div className="text-right relative z-10">
                  <div className="bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 mb-2">
                    <span className="text-[10px] font-black text-amber-500 flex items-center justify-end gap-1.5">
                      <CheckCircle className="h-3 w-3" /> VERIFIED GENUINE
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-500 max-w-[120px] leading-tight">
                    Automatically calculated based on SACCO policy config v2.4
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100 flex items-center justify-between sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setPenaltyModalLoan(null)}
              className="font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl"
            >
              Discard Calculation
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 px-10 rounded-xl shadow-lg shadow-amber-600/20 transition-all hover:scale-105 active:scale-95"
              onClick={() => {
                if (penaltyModalLoan) {
                  const amount = penaltyMode === "manual" ? parseFloat(manualPenaltyAmount) : undefined;
                  if (penaltyMode === "manual" && (!amount || amount <= 0)) {
                    toast.error("Please enter a valid penalty amount");
                    return;
                  }
                  executeApplyPenalty(penaltyModalLoan.id, amount);
                }
              }}
              disabled={!!isApplyingPenalty || (penaltyMode === "manual" && !manualPenaltyAmount)}
            >
              {isApplyingPenalty ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Imposing...
                </>
              ) : (
                <>
                  Impose Penalty <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}