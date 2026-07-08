// // @ts-nocheck
// "use client";
// import { useState } from "react";
// import * as XLSX from "xlsx";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";

// import { Column, DataTable, TableActions } from "@/components/ui/data-table";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   Eye,
//   DollarSign,
//   User,
//   CreditCard,
//   Calendar,
//   TrendingDown,
//   Building,
//   Phone,
//   FileText,
//   ArrowDownLeft,
// } from "lucide-react";

// import { formatISODate } from "@/lib/utils";
// import { getWithdrawalChannelInfo, Withdrawal } from "@/types/withdraw";
// import WithdrawalCreateForm from "./WithdrawTestCreateForm";
// import { db } from "@/prisma/db";
// import Link from "next/link";

// interface WithdrawalStatistics {
//   today: {
//     amount: number;
//     count: {
//       id: number;
//     };
//   };
//   thisMonth: {
//     amount: number;
//     count: {
//       id: number;
//     };
//   };
//   total: {
//     amount: number;
//     count: {
//       id: number;
//     };
//   };
// }

// export default function WithdrawalListingTest({
//   withdrawals,
//   title,
//   subtitle,
//   statistics,
//   userRole,
//   currentUserId,
// }: {
//   withdrawals: Withdrawal[];
//   title: string;
//   subtitle: string;
//   statistics: WithdrawalStatistics;
//   userRole: any;
//   currentUserId: string;
// }) {
//   console.log(statistics);
//   const router = useRouter();
//   const [modalOpen, setModalOpen] = useState(false);

//   // Format currency
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   // Get account type display name
//   const getAccountTypeDisplayName = (name: string) => {
//     const displayNames: { [key: string]: string } = {
//       VOLUNTARY_SAVINGS: "Voluntary Savings",
//       FIXED_DEPOSIT: "Fixed Deposit",
//       EMERGENCY_SAVINGS: "Emergency Savings",
//     };
//     return displayNames[name] || name;
//   };

//   const columns: Column<Withdrawal>[] = [
//     {
//       accessorKey: "transaction",
//       header: "Transaction Details",
//       cell: (row) => {
//         const withdrawal = row;
//         const channelInfo = getWithdrawalChannelInfo(withdrawal.channel);

//         return (
//           <div className="flex items-center gap-3">
//             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
//               <TrendingDown className="h-5 w-5" />
//             </div>
//             <div className="flex flex-col">
//               <div className="flex items-center gap-2">
//                 <span className="font-medium">
//                   {withdrawal.transaction.transactionRef}
//                 </span>
//                 {/* <Badge className={channelInfo.color}>
//                   {channelInfo.icon} {channelInfo.label}
//                 </Badge> */}
//               </div>
//               <span className="text-sm text-gray-500">
//                 {formatISODate(withdrawal.withdrawalDate)}
//               </span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "member",
//       header: "Member Info",
//       cell: (row) => {
//         const withdrawal = row;
//         const member = withdrawal.member;
//         const user = member.user;

//         return (
//           <div className="flex items-center gap-3">
//             <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
//               {user.image ? (
//                 <img
//                   src={user.image}
//                   alt={user.name}
//                   className="h-8 w-8 rounded-full object-cover"
//                 />
//               ) : (
//                 <User className="h-4 w-4" />
//               )}
//             </div>
//             <div className="flex flex-col">
//               <span className="font-medium">{user.name}</span>
//               <div className="flex items-center gap-1 text-sm text-gray-500">
//                 <span>#{member.memberNumber}</span>
//                 {/* {user.phone && (
//                   <>
//                     <span>•</span>
//                     <span>{user.phone}</span>
//                   </>
//                 )} */}
//               </div>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "account",
//       header: "Account Details",
//       cell: (row) => {
//         const withdrawal = row;
//         const account = withdrawal.account;

//         return (
//           <div className="flex flex-col gap-1">
//             <div className="flex items-center gap-1">
//               <CreditCard className="h-4 w-4 text-blue-500" />
//               <span className="font-medium">{account.accountNumber}</span>
//             </div>
//             <span className="text-sm text-gray-500">
//               {getAccountTypeDisplayName(account.accountType.name)}
//             </span>
//             {/* <div className="flex items-center gap-1 text-sm text-gray-500">
//               <Building className="h-3 w-3" />
//               <span>{account.branch.name}</span>
//             </div> */}
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "amount",
//       header: "Amount",
//       cell: (row) => {
//         const withdrawal = row;

//         return (
//           <div className="flex items-center gap-2">
//             <ArrowDownLeft className="h-4 w-4 text-red-600" />
//             <span className="font-medium text-red-700 text-lg">
//               {formatCurrency(withdrawal.amount)}
//             </span>
//           </div>
//         );
//       },
//     },
//     // {
//     //   accessorKey: "channel",
//     //   header: "Payment Method",
//     //   cell: (row) => {
//     //     const withdrawal = row;
//     //     const channelInfo = getWithdrawalChannelInfo(withdrawal.channel);

//     //     return (
//     //       <div className="flex flex-col gap-1">
//     //         <Badge className={channelInfo.color}>
//     //           {channelInfo.icon} {channelInfo.label}
//     //         </Badge>
//     //         {withdrawal.mobileMoneyRef && (
//     //           <div className="flex items-center gap-1 text-sm text-gray-500">
//     //             <Phone className="h-3 w-3" />
//     //             <span>Ref: {withdrawal.mobileMoneyRef}</span>
//     //           </div>
//     //         )}
//     //       </div>
//     //     );
//     //   },
//     // },
//     // {
//     //   accessorKey: "handler",
//     //   header: "Processed By",
//     //   cell: (row) => {
//     //     const withdrawal = row;
//     //     const handler = withdrawal.handler;

//     //     return (
//     //       <div className="flex flex-col">
//     //         <span className="font-medium">{handler.name}</span>
//     //         <Badge variant="outline" className="text-xs w-fit">
//     //           {handler.role}
//     //         </Badge>
//     //       </div>
//     //     );
//     //   },
//     // },

//     {
//       accessorKey: "id",
//       header: "Actions",
//       cell: (row) => {
//         const withdrawal = row;

//         return (
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={() =>
//               router.push(`/dashboard/withdrawals/${withdrawal.id}`)
//             }
//           >
//             <Eye className="h-4 w-4 mr-1" />
//             View
//           </Button>
//         );
//       },
//     },
//   ];

//   const handleAddNew = () => {
//     setModalOpen(true);
//   };

//   // Export to Excel
//   const handleExport = async (filteredWithdrawals: Withdrawal[]) => {
//     try {
//       // Prepare data for export
//       const exportData = filteredWithdrawals.map((withdrawal) => ({
//         "Transaction Ref": withdrawal.transaction.transactionRef,
//         "Member Name": withdrawal.member.user.name,
//         "Member Number": withdrawal.member.memberNumber,
//         "Account Number": withdrawal.account.accountNumber,
//         "Account Type": getAccountTypeDisplayName(
//           withdrawal.account.accountType.name
//         ),
//         Amount: withdrawal.amount,
//         Channel: withdrawal.channel,
//         "Mobile Money Ref": withdrawal.mobileMoneyRef || "N/A",
//         Branch: withdrawal.account.branch.name,
//         "Branch Location": withdrawal.account.branch.location,
//         "Processed By": withdrawal.handler.name,
//         "Handler Role": withdrawal.handler.role,
//         "Withdrawal Date": formatISODate(withdrawal.withdrawalDate),
//         Description: withdrawal.transaction.description || "N/A",
//         "Transaction Status": withdrawal.transaction.status,
//         "Member Email": withdrawal.member.user.email,
//         "Member Phone": withdrawal.member.user.phone || "N/A",
//       }));

//       // Create workbook and worksheet
//       const worksheet = XLSX.utils.json_to_sheet(exportData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "Withdrawals");

//       // Generate filename with current date
//       const fileName = `Withdrawals_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

//       // Export to file
//       XLSX.writeFile(workbook, fileName);

//       toast.success("Export successful", {
//         description: `Withdrawals exported to ${fileName}`,
//       });
//     } catch (error) {
//       toast.error("Export failed", {
//         description:
//           error instanceof Error ? error.message : "Unknown error occurred",
//       });
//     }
//   };

//   return (
//     <div className="container mx-auto py-6">
//       {/* Statistics Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
//         <Link href="/dashboard/withdraw-test/todayswithdraws">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Today's Withdrawals
//               </CardTitle>
//               <TrendingDown className="h-4 w-4 text-red-600" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-red-700">
//                 {formatCurrency(statistics.today.amount)}
//               </div>
//               <p className="text-xs text-gray-500">
//                 {statistics.today.count.id} transactions today
//               </p>
//             </CardContent>
//           </Card>
//         </Link>

//         <Link href="/dashboard/withdraw-test/monthlywithdraws">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">This Month</CardTitle>
//               <Calendar className="h-4 w-4 text-blue-600" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-blue-700">
//                 {formatCurrency(statistics.thisMonth.amount)}
//               </div>
//               <p className="text-xs text-gray-500">
//                 {statistics.thisMonth.count.id} transactions this month
//               </p>
//             </CardContent>
//           </Card>
//         </Link>

//         <Link href="/dashboard/withdraw-test/totalwithdraws">
//           <Card>
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 Total Withdrawals
//               </CardTitle>
//               <DollarSign className="h-4 w-4 text-purple-600" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold text-purple-700">
//                 {formatCurrency(statistics.total.amount)}
//               </div>
//               <p className="text-xs text-gray-500">
//                 {statistics.total.count.id} total transactions
//               </p>
//             </CardContent>
//           </Card>
//         </Link>
//       </div>

//       <WithdrawalCreateForm
//         isOpen={modalOpen}
//         onClose={() => setModalOpen(false)}
//         currentUserId={currentUserId}
//       />

//       <DataTable<Withdrawal>
//         title={title}
//         subtitle={subtitle}
//         data={withdrawals}
//         columns={columns}
//         keyField="id"
//         isLoading={false}
//         onRefresh={() => router.refresh()}
//         actions={{
//           onAdd: ["ADMIN", "MANAGER", "TELLER", "AGENT"].includes(userRole)
//             ? handleAddNew
//             : undefined,
//           onExport: handleExport,
//         }}
//         filters={{
//           searchFields: [
//             "transaction.transactionRef",
//             "member.user.name",
//             "member.memberNumber",
//             "account.accountNumber",
//           ],
//           enableDateFilter: true,
//           getItemDate: (item) => item.withdrawalDate,
//         }}
//         renderRowActions={(item) => (
//           <TableActions.RowActions
//           // No edit/delete for withdrawals as they're financial records
//           // onView={() => router.push(`/dashboard/withdrawals/${item.id}`)}
//           />
//         )}
//       />
//     </div>
//   );
// }
// @ts-nocheck
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye,
  DollarSign,
  User,
  CreditCard,
  Calendar,
  TrendingDown,
  Building,
  Phone,
  FileText,
  ArrowDownLeft,
  Plus,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import { getWithdrawalChannelInfo, Withdrawal } from "@/types/withdraw";
import WithdrawalCreateForm from "./WithdrawTestCreateForm";
import Link from "next/link";

interface WithdrawalStatistics {
  today: {
    amount: number;
    count: {
      id: number;
    };
  };
  thisMonth: {
    amount: number;
    count: {
      id: number;
    };
  };
  total: {
    amount: number;
    count: {
      id: number;
    };
  };
}

export default function WithdrawalListingTest({
  withdrawals,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  withdrawals: Withdrawal[];
  title: string;
  subtitle: string;
  statistics: WithdrawalStatistics;
  userRole: any;
  currentUserId: string;
}) {
  console.log('WithdrawalListingTest [statistics]:', statistics);
  console.log('WithdrawalListingTest [withdrawals count]:', withdrawals?.length, 'raw:', withdrawals);
  console.log('WithdrawalListingTest [userRole]:', userRole);
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Get account type display name
  const getAccountTypeDisplayName = (name: string) => {
    const displayNames: { [key: string]: string } = {
      VOLUNTARY_SAVINGS: "Voluntary Savings",
      FIXED_DEPOSIT: "Fixed Deposit",
      EMERGENCY_SAVINGS: "Emergency Savings",
    };
    return displayNames[name] || name;
  };

  const columns: Column<Withdrawal>[] = [
    {
      accessorKey: "transaction",
      header: "Transaction Details",
      cell: (row) => {
        const withdrawal = row;
        const channelInfo = getWithdrawalChannelInfo(withdrawal.channel);

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {withdrawal.transaction.transactionRef}
                </span>
                {/* <Badge className={channelInfo.color}>
                  {channelInfo.icon} {channelInfo.label}
                </Badge> */}
              </div>
              <span className="text-sm text-gray-500">
                {formatISODate(withdrawal.withdrawalDate)}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "member",
      header: "Member Info",
      cell: (row) => {
        const withdrawal = row;
        const member = withdrawal.member;
        const institution = withdrawal.institution;
        const user = member?.user || institution?.user;
        const name = user?.name || institution?.institutionName || "Unknown Source";
        const identification = member ? `#${member.memberNumber}` : institution ? "(Institution)" : "N/A";

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              {user?.image ? (
                <img
                  src={user.image}
                  alt={name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-slate-900">{name}</span>
              <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                <span>{identification}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "account",
      header: "Account Details",
      cell: (row) => {
        const withdrawal = row;
        const account = withdrawal.account;

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{account.accountNumber}</span>
            </div>
            <span className="text-sm text-gray-500">
              {getAccountTypeDisplayName(account.accountType.name)}
            </span>
            {/* <div className="flex items-center gap-1 text-sm text-gray-500">
              <Building className="h-3 w-3" />
              <span>{account.branch.name}</span>
            </div> */}
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const withdrawal = row;

        return (
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-red-600" />
            <span className="font-medium text-red-700 text-lg">
              {formatCurrency(withdrawal.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "fee",
      header: "Fee",
      cell: (row) => {
        return (
          <span className="font-semibold text-amber-700">
            {formatCurrency(row.fee ?? 0)}
          </span>
        );
      },
    },
    // {
    //   accessorKey: "channel",
    //   header: "Payment Method",
    //   cell: (row) => {
    //     const withdrawal = row;
    //     const channelInfo = getWithdrawalChannelInfo(withdrawal.channel);

    //     return (
    //       <div className="flex flex-col gap-1">
    //         <Badge className={channelInfo.color}>
    //           {channelInfo.icon} {channelInfo.label}
    //         </Badge>
    //         {withdrawal.mobileMoneyRef && (
    //           <div className="flex items-center gap-1 text-sm text-gray-500">
    //             <Phone className="h-3 w-3" />
    //             <span>Ref: {withdrawal.mobileMoneyRef}</span>
    //           </div>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    // {
    //   accessorKey: "handler",
    //   header: "Processed By",
    //   cell: (row) => {
    //     const withdrawal = row;
    //     const handler = withdrawal.handler;

    //     return (
    //       <div className="flex flex-col">
    //         <span className="font-medium">{handler.name}</span>
    //         <Badge variant="outline" className="text-xs w-fit">
    //           {handler.role}
    //         </Badge>
    //       </div>
    //     );
    //   },
    // },

    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const withdrawal = row;

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/withdrawals/${withdrawal.id}`)
            }
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        );
      },
    },
  ];

  const handleAddNew = () => {
    setModalOpen(true);
  };

  // Export to Excel
  const handleExport = async (filteredWithdrawals: Withdrawal[]) => {
    try {
      // Prepare data for export
      const exportData = filteredWithdrawals.map((withdrawal) => ({
        "Transaction Ref": withdrawal.transaction.transactionRef,
        "Source Name": withdrawal.member?.user.name || withdrawal.institution?.institutionName || "Unknown",
        "Member Number": withdrawal.member?.memberNumber || "Institution",
        "Account Number": withdrawal.account.accountNumber,
        "Account Type": getAccountTypeDisplayName(
          withdrawal.account.accountType.name
        ),
        Amount: withdrawal.amount,
        Fee: withdrawal.fee ?? 0,
        Channel: withdrawal.channel,
        "Mobile Money Ref": withdrawal.mobileMoneyRef || "N/A",
        Branch: withdrawal.account.branch.name,
        "Branch Location": withdrawal.account.branch.location,
        "Processed By": withdrawal.handler.name,
        "Handler Role": withdrawal.handler.role,
        "Withdrawal Date": formatISODate(withdrawal.withdrawalDate),
        Description: withdrawal.transaction.description || "N/A",
        "Transaction Status": withdrawal.transaction.status,
        "Owner Email": withdrawal.member?.user.email || withdrawal.institution?.user?.email || "N/A",
        "Owner Phone": withdrawal.member?.user.phone || withdrawal.institution?.user?.phone || "N/A",
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Withdrawals");

      // Generate filename with current date
      const fileName = `Withdrawals_${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      // Export to file
      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Withdrawals exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Link href="/dashboard/withdraw-test/todayswithdraws">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Withdrawals
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                {formatCurrency(statistics.today.amount)}
              </div>
              <p className="text-xs text-gray-500">
                {statistics.today.count.id} transactions today
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/withdraw-test/monthlywithdraws">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(statistics.thisMonth.amount)}
              </div>
              <p className="text-xs text-gray-500">
                {statistics.thisMonth.count.id} transactions this month
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/withdraw-test/totalwithdraws">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Withdrawals
              </CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {formatCurrency(statistics.total.amount)}
              </div>
              <p className="text-xs text-gray-500">
                {statistics.total.count.id} total transactions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <WithdrawalCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
      />

      {/* DEBUG: Show withdrawal count */}
      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-sm">
        DEBUG: {withdrawals?.length ?? 0} withdrawals passed to DataTable
      </div>

      <DataTable<Withdrawal>
        title={title}
        subtitle={subtitle}
        data={withdrawals}
        columns={columns}
        keyField="id"
        isLoading={false}
        onRefresh={() => router.refresh()}
        actions={{
          onAdd: ["ADMIN", "MANAGER", "TELLER", "AGENT"].includes(userRole)
            ? handleAddNew
            : undefined,
          onExport: handleExport,
        }}
        filters={{
          searchFields: [
            "transaction.transactionRef",
            "member.user.name",
            "member.memberNumber",
            "institution.institutionName",
            "institution.user.name",
            "account.accountNumber",
          ],
          enableDateFilter: true,
          getItemDate: (item) => item.withdrawalDate,
        }}
        renderRowActions={(item) => (
          <TableActions.RowActions
          // No edit/delete for withdrawals as they're financial records
          // onView={() => router.push(`/dashboard/withdrawals/${item.id}`)}
          />
        )}
      />
    </div>
  );
}
