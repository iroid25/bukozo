// //@ts-nocheck
// "use client";
// import { useState } from "react";
// import * as XLSX from "xlsx";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";

// import { Column, DataTable, TableActions } from "@/components/ui/data-table";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import {
//   Eye,
//   DollarSign,
//   User,
//   Building,
//   Calculator,
//   TrendingUp,
//   AlertTriangle,
//   CheckCircle,
//   Plus,
//   Wallet,
//   BarChart3,
//   Clock,
//   Users,
// } from "lucide-react";

// import {
//   UserFloat,
//   FloatTransaction,
//   FloatAllocation,
//   FloatReconciliation,
//   getFloatTransactionTypeInfo,
//   getReconciliationStatus,
//   getFloatStatus,
//   getFloatUserRoleInfo,
//   calculateFloatUtilization,
// } from "@/types/float";

// import { formatISODate } from "@/lib/utils";
// import FloatAllocationCreateForm from "./FloatAllocationForm";
// import FloatReconciliationCreateForm from "./FloatReconciliationForm";
// import { UserRole } from "@prisma/client";

// interface FloatStatistics {
//   totalFloats: number;
//   totalBalance: number;
//   activeFloats: number;
//   pendingReconciliations: number;
//   todayAllocations: number;
//   todayReconciliations: number;
//   branchAllocations: Array<{
//     branchId: string;
//     amount: number;
//     count: number;
//   }>;
//   reconciliationStatus: {
//     balanced: number;
//     unbalanced: number;
//   };
// }

// export default function FloatOverviewListing({
//   userFloats,
//   floatTransactions,
//   floatAllocations,
//   floatReconciliations,
//   title,
//   subtitle,
//   statistics,
//   userRole,
//   currentUserId,
// }: {
//   userFloats: UserFloat[];
//   floatTransactions: FloatTransaction[];
//   floatAllocations: FloatAllocation[];
//   floatReconciliations: FloatReconciliation[];
//   title: string;
//   subtitle: string;
//   statistics: FloatStatistics;
//   userRole: string;
//   currentUserId: string;
// }) {
//   const router = useRouter();
//   const [allocationModalOpen, setAllocationModalOpen] = useState(false);
//   const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

//   // Format currency
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   // User Floats Columns
//   const userFloatColumns: Column<UserFloat>[] = [
//     {
//       accessorKey: "user",
//       header: "User Details",
//       cell: (row) => {
//         const userFloat = row;
//         const user = userFloat.user;
//         const roleInfo = getFloatUserRoleInfo(user.role as UserRole);
//         const floatStatus = getFloatStatus(
//           userFloat.balance,
//           userFloat.lastReconciliation
//         );

//         return (
//           <div className="flex items-center gap-3">
//             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
//               {user.image ? (
//                 <img
//                   src={user.image}
//                   alt={user.name}
//                   className="h-10 w-10 rounded-full object-cover"
//                 />
//               ) : (
//                 <User className="h-5 w-5" />
//               )}
//             </div>
//             <div className="flex flex-col">
//               <div className="flex items-center gap-2">
//                 <span className="font-medium">{user.name}</span>
//                 <Badge className={roleInfo.color}>
//                   {roleInfo.icon} {roleInfo.label}
//                 </Badge>
//               </div>
//               <div className="flex items-center gap-2 text-sm text-gray-500">
//                 <span>{user.email}</span>
//                 <Badge className={`${floatStatus.color} text-xs`}>
//                   {floatStatus.icon} {floatStatus.label}
//                 </Badge>
//               </div>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "balance",
//       header: "Branch",
//       cell: (row) => {
//         const userFloat = row;
//         const branch = userFloat.user.branch;

//         return branch ? (
//           <div className="flex items-center gap-2">
//             <Building className="h-4 w-4 text-gray-500" />
//             <div className="flex flex-col">
//               <span className="font-medium">{branch.name}</span>
//               <span className="text-sm text-gray-500">{branch.location}</span>
//             </div>
//           </div>
//         ) : (
//           <span className="text-gray-400 italic">No branch assigned</span>
//         );
//       },
//     },
//     {
//       accessorKey: "balance",
//       header: "Float Balance",
//       cell: (row) => {
//         const userFloat = row;
//         const status = getFloatStatus(
//           userFloat.balance,
//           userFloat.lastReconciliation
//         );

//         return (
//           <div className="flex flex-col">
//             <span className="text-xl font-bold text-green-600">
//               {formatCurrency(userFloat.balance)}
//             </span>
//             <div className="flex items-center gap-1 text-xs">
//               <span className={`px-2 py-1 rounded ${status.color}`}>
//                 {status.label}
//               </span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "lastReconciliation",
//       header: "Last Reconciliation",
//       cell: (row) => {
//         const userFloat = row;

//         return userFloat.lastReconciliation ? (
//           <div className="flex items-center gap-2">
//             <Clock className="h-4 w-4 text-gray-500" />
//             <div className="flex flex-col">
//               <span className="font-medium">
//                 {formatISODate(userFloat.lastReconciliation)}
//               </span>
//               <span className="text-sm text-gray-500">
//                 {format(new Date(userFloat.lastReconciliation), "HH:mm")}
//               </span>
//             </div>
//           </div>
//         ) : (
//           <span className="text-red-500 italic">Never reconciled</span>
//         );
//       },
//     },
//     {
//       accessorKey: "id",
//       header: "Actions",
//       cell: (row) => {
//         const userFloat = row;

//         return (
//           <div className="flex gap-2">
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={() =>
//                 router.push(`/dashboard/floats/users/${userFloat.user.id}`)
//               }
//             >
//               <Eye className="h-4 w-4 mr-1" />
//               View
//             </Button>
//           </div>
//         );
//       },
//     },
//   ];

//   // Float Transactions Columns
//   const transactionColumns: Column<FloatTransaction>[] = [
//     {
//       accessorKey: "float",
//       header: "User",
//       cell: (row) => {
//         const transaction = row;
//         const user = transaction.float.user;

//         return (
//           <div className="flex items-center gap-2">
//             <User className="h-4 w-4 text-gray-500" />
//             <div className="flex flex-col">
//               <span className="font-medium">{user.name}</span>
//               <span className="text-sm text-gray-500">{user.role}</span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "type",
//       header: "Transaction Type",
//       cell: (row) => {
//         const transaction = row;
//         const typeInfo = getFloatTransactionTypeInfo(transaction.type);

//         return (
//           <div className="flex items-center gap-2">
//             <Badge className={typeInfo.color}>
//               {typeInfo.icon} {typeInfo.label}
//             </Badge>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "amount",
//       header: "Amount",
//       cell: (row) => {
//         const transaction = row;
//         const isPositive = transaction.amount > 0;

//         return (
//           <span
//             className={`font-medium text-lg ${
//               isPositive ? "text-green-600" : "text-red-600"
//             }`}
//           >
//             {isPositive ? "+" : ""}
//             {formatCurrency(transaction.amount)}
//           </span>
//         );
//       },
//     },
//     {
//       accessorKey: "transactionDate",
//       header: "Date & Time",
//       cell: (row) => {
//         const transaction = row;

//         return (
//           <div className="flex flex-col">
//             <span className="font-medium">
//               {formatISODate(transaction.transactionDate)}
//             </span>
//             <span className="text-sm text-gray-500">
//               {format(new Date(transaction.transactionDate), "HH:mm:ss")}
//             </span>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "performedByUser",
//       header: "Performed By",
//       cell: (row) => {
//         const transaction = row;

//         return (
//           <div className="flex flex-col">
//             <span className="font-medium">
//               {transaction.performedByUser.name}
//             </span>
//             <Badge variant="outline" className="text-xs w-fit">
//               {transaction.performedByUser.role}
//             </Badge>
//           </div>
//         );
//       },
//     },
//   ];

//   // Float Allocations Columns
//   const allocationColumns: Column<FloatAllocation>[] = [
//     {
//       accessorKey: "tellerAgent",
//       header: "Recipient",
//       cell: (row) => {
//         const allocation = row;
//         const agent = allocation.tellerAgent;
//         const roleInfo = getFloatUserRoleInfo(agent.role as UserRole);

//         return (
//           <div className="flex items-center gap-3">
//             <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
//               <User className="h-4 w-4" />
//             </div>
//             <div className="flex flex-col">
//               <span className="font-medium">{agent.name}</span>
//               <Badge className={`${roleInfo.color} text-xs w-fit`}>
//                 {roleInfo.icon} {roleInfo.label}
//               </Badge>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "branch",
//       header: "Branch",
//       cell: (row) => {
//         const allocation = row;

//         return (
//           <div className="flex items-center gap-2">
//             <Building className="h-4 w-4 text-gray-500" />
//             <div className="flex flex-col">
//               <span className="font-medium">{allocation.branch.name}</span>
//               <span className="text-sm text-gray-500">
//                 {allocation.branch.location}
//               </span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "amount",
//       header: "Amount Allocated",
//       cell: (row) => {
//         const allocation = row;

//         return (
//           <span className="text-xl font-bold text-blue-600">
//             {formatCurrency(allocation.amount)}
//           </span>
//         );
//       },
//     },
//     // {
//     //   accessorKey: "allocationDate",
//     //   header: "Allocation Date",
//     //   cell: (row) => {
//     //     const allocation = row;

//     //     return (
//     //       <div className="flex flex-col">
//     //         <span className="font-medium">
//     //           {formatISODate(allocation.allocationDate)}
//     //         </span>
//     //         <span className="text-sm text-gray-500">
//     //           by {allocation.allocatedByUser.name}
//     //         </span>
//     //       </div>
//     //     );
//     //   },
//     // },
//   ];

//   // Float Reconciliations Columns
//   const reconciliationColumns: Column<FloatReconciliation>[] = [
//     {
//       accessorKey: "float",
//       header: "User",
//       cell: (row) => {
//         const reconciliation = row;
//         const user = reconciliation.float.user;

//         return (
//           <div className="flex items-center gap-2">
//             <User className="h-4 w-4 text-gray-500" />
//             <div className="flex flex-col">
//               <span className="font-medium">{user.name}</span>
//               <span className="text-sm text-gray-500">{user.role}</span>
//             </div>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "reconciledByUser",
//       header: "Reconciliation Details",
//       cell: (row) => {
//         const reconciliation = row;
//         const status = getReconciliationStatus(
//           reconciliation.actualCash,
//           reconciliation.systemBalance
//         );

//         return (
//           <div className="flex flex-col gap-1">
//             <div className="flex items-center gap-2">
//               <Badge className={status.color}>
//                 {status.icon} {status.label}
//               </Badge>
//             </div>
//             <div className="grid grid-cols-2 gap-2 text-sm">
//               <div>
//                 <span className="text-gray-500">System: </span>
//                 <span className="font-medium">
//                   {formatCurrency(reconciliation.systemBalance)}
//                 </span>
//               </div>
//               <div>
//                 <span className="text-gray-500">Actual: </span>
//                 <span className="font-medium">
//                   {formatCurrency(reconciliation.actualCash)}
//                 </span>
//               </div>
//             </div>
//             {reconciliation.difference !== 0 && (
//               <div className="text-sm">
//                 <span className="text-gray-500">Difference: </span>
//                 <span
//                   className={`font-medium ${
//                     reconciliation.difference > 0
//                       ? "text-green-600"
//                       : "text-red-600"
//                   }`}
//                 >
//                   {reconciliation.difference > 0 ? "+" : ""}
//                   {formatCurrency(reconciliation.difference)}
//                 </span>
//               </div>
//             )}
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "reconciliationDate",
//       header: "Reconciliation Date",
//       cell: (row) => {
//         const reconciliation = row;

//         return (
//           <div className="flex flex-col">
//             <span className="font-medium">
//               {formatISODate(reconciliation.reconciliationDate)}
//             </span>
//             <span className="text-sm text-gray-500">
//               by {reconciliation.reconciledByUser.name}
//             </span>
//           </div>
//         );
//       },
//     },
//   ];

//   // Export functions
//   const exportUserFloats = async (filteredData: UserFloat[]) => {
//     try {
//       const exportData = filteredData.map((userFloat) => ({
//         "User Name": userFloat.user.name,
//         "User Email": userFloat.user.email,
//         "User Role": userFloat.user.role,
//         Branch: userFloat.user.branch?.name || "N/A",
//         "Branch Location": userFloat.user.branch?.location || "N/A",
//         "Current Balance": userFloat.balance,
//         "Last Reconciliation": userFloat.lastReconciliation
//           ? formatISODate(userFloat.lastReconciliation)
//           : "Never",
//         Status: getFloatStatus(userFloat.balance, userFloat.lastReconciliation)
//           .label,
//       }));

//       const worksheet = XLSX.utils.json_to_sheet(exportData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "User Floats");

//       const fileName = `User_Floats_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
//       XLSX.writeFile(workbook, fileName);

//       toast.success("Export successful", {
//         description: `User floats exported to ${fileName}`,
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
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Floats</CardTitle>
//             <Users className="h-4 w-4 text-blue-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-blue-700">
//               {statistics.totalFloats}
//             </div>
//             <p className="text-xs text-gray-500">
//               Active: {statistics.activeFloats}
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
//             <Wallet className="h-4 w-4 text-green-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-green-700">
//               {formatCurrency(statistics.totalBalance)}
//             </div>
//             <p className="text-xs text-gray-500">Across all floats</p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Pending Reconciliations
//             </CardTitle>
//             <AlertTriangle className="h-4 w-4 text-orange-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-orange-700">
//               {statistics.pendingReconciliations}
//             </div>
//             <p className="text-xs text-gray-500">Need attention</p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Today's Activity
//             </CardTitle>
//             <TrendingUp className="h-4 w-4 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-purple-700">
//               {statistics.todayAllocations + statistics.todayReconciliations}
//             </div>
//             <p className="text-xs text-gray-500">
//               {statistics.todayAllocations} allocations,{" "}
//               {statistics.todayReconciliations} reconciliations
//             </p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Reconciliation Status Summary */}
//       {(statistics.reconciliationStatus.balanced > 0 ||
//         statistics.reconciliationStatus.unbalanced > 0) && (
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
//           <Card className="bg-green-50">
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <CheckCircle className="h-5 w-5 text-green-600" />
//                   <div>
//                     <p className="text-sm font-medium">
//                       Balanced Reconciliations
//                     </p>
//                     <p className="text-xs text-gray-500">Last 30 days</p>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-2xl font-bold text-green-600">
//                     {statistics.reconciliationStatus.balanced}
//                   </p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           <Card className="bg-red-50">
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <AlertTriangle className="h-5 w-5 text-red-600" />
//                   <div>
//                     <p className="text-sm font-medium">
//                       Unbalanced Reconciliations
//                     </p>
//                     <p className="text-xs text-gray-500">Last 30 days</p>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   <p className="text-2xl font-bold text-red-600">
//                     {statistics.reconciliationStatus.unbalanced}
//                   </p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}

//       {/* Action Modals */}
//       <FloatAllocationCreateForm
//         isOpen={allocationModalOpen}
//         onClose={() => setAllocationModalOpen(false)}
//         currentUserId={currentUserId}
//       />

//       <FloatReconciliationCreateForm
//         isOpen={reconciliationModalOpen}
//         onClose={() => setReconciliationModalOpen(false)}
//         currentUserId={currentUserId}
//       />

//       {/* Main Content Tabs */}
//       <Tabs defaultValue="floats" className="space-y-6">
//         <TabsList className="grid w-full grid-cols-4">
//           <TabsTrigger value="floats">
//             User Floats ({userFloats.length})
//           </TabsTrigger>
//           <TabsTrigger value="transactions">
//             Transactions ({floatTransactions.length})
//           </TabsTrigger>
//           <TabsTrigger value="allocations">
//             Allocations ({floatAllocations.length})
//           </TabsTrigger>
//           <TabsTrigger value="reconciliations">
//             Reconciliations ({floatReconciliations.length})
//           </TabsTrigger>
//         </TabsList>

//         <TabsContent value="floats">
//           <DataTable<UserFloat>
//             title="User Float Balances"
//             subtitle="Monitor individual user float balances and status"
//             data={userFloats}
//             columns={userFloatColumns}
//             keyField="id"
//             isLoading={false}
//             onRefresh={() => router.refresh()}
//             actions={{
//               onAdd: ["ADMIN", "MANAGER"].includes(userRole)
//                 ? () => setAllocationModalOpen(true)
//                 : undefined,
//               onExport: exportUserFloats,
//             }}
//             filters={{
//               searchFields: ["user.name", "user.email", "user.branch.name"],
//               enableDateFilter: false,
//             }}
//             renderRowActions={(item) => (
//               <TableActions.RowActions
//               // onView={() =>
//               //   router.push(`/dashboard/float/users/${item.user.id}`)
//               // }
//               />
//             )}
//           />
//         </TabsContent>

//         <TabsContent value="transactions">
//           <DataTable<FloatTransaction>
//             title="Float Transactions"
//             subtitle="All float-related transactions and movements"
//             data={floatTransactions}
//             columns={transactionColumns}
//             keyField="id"
//             isLoading={false}
//             onRefresh={() => router.refresh()}
//             filters={{
//               searchFields: [
//                 "float.user.name",
//                 "performedByUser.name",
//                 "description",
//               ],
//               enableDateFilter: true,
//               getItemDate: (item) => item.transactionDate,
//             }}
//           />
//         </TabsContent>

//         <TabsContent value="allocations">
//           <DataTable<FloatAllocation>
//             title="Float Allocations"
//             subtitle="Track float allocations to tellers and agents"
//             data={floatAllocations}
//             columns={allocationColumns}
//             keyField="id"
//             isLoading={false}
//             onRefresh={() => router.refresh()}
//             actions={{
//               onAdd: ["ADMIN", "MANAGER"].includes(userRole)
//                 ? () => setAllocationModalOpen(true)
//                 : undefined,
//             }}
//             filters={{
//               searchFields: [
//                 "tellerAgent.name",
//                 "branch.name",
//                 "allocatedByUser.name",
//               ],
//               enableDateFilter: true,
//               getItemDate: (item) => item.allocationDate,
//             }}
//           />
//         </TabsContent>

//         <TabsContent value="reconciliations">
//           <DataTable<FloatReconciliation>
//             title="Float Reconciliations"
//             subtitle="Track float reconciliation history and discrepancies"
//             data={floatReconciliations}
//             columns={reconciliationColumns}
//             keyField="id"
//             isLoading={false}
//             onRefresh={() => router.refresh()}
//             actions={{
//               onAdd: ["ADMIN", "MANAGER", "TELLER", "AGENT"].includes(userRole)
//                 ? () => setReconciliationModalOpen(true)
//                 : undefined,
//             }}
//             filters={{
//               searchFields: ["float.user.name", "reconciledByUser.name"],
//               enableDateFilter: true,
//               getItemDate: (item) => item.reconciliationDate,
//             }}
//           />
//         </TabsContent>
//       </Tabs>
//     </div>
//   );
// }
// app/dashboard/floats/components/FloatOverviewListing.tsx
// @ts-nocheck
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable, TableActions } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Eye,
  User,
  Building,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
} from "lucide-react";

import {
  UserFloat,
  FloatTransaction,
  FloatAllocation,
  FloatReconciliation,
  getFloatTransactionTypeInfo,
  getReconciliationStatus,
  getFloatStatus,
  getFloatUserRoleInfo,
} from "@/types/float";

import { formatISODate } from "@/lib/utils";
import FloatAllocationCreateForm from "./FloatAllocationForm";
import FloatReconciliationCreateForm from "./FloatReconciliationForm";
import { UserRole } from "@prisma/client";

interface FloatStatistics {
  totalFloats: number;
  totalBalance: number;
  activeFloats: number;
  pendingReconciliations: number;
  todayAllocations: number;
  todayReconciliations: number;
  branchAllocations: Array<{ branchId: string; amount: number; count: number }>;
  reconciliationStatus: { balanced: number; unbalanced: number };
}

export default function FloatOverviewListing({
  userFloats,
  floatTransactions,
  floatAllocations,
  floatReconciliations,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: {
  userFloats: UserFloat[];
  floatTransactions: FloatTransaction[];
  floatAllocations: FloatAllocation[];
  floatReconciliations: FloatReconciliation[];
  title: string;
  subtitle: string;
  statistics: FloatStatistics;
  userRole: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [reconciliationModalOpen, setReconciliationModalOpen] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);

  const userFloatColumns: Column<UserFloat>[] = [
    {
      accessorKey: "user",
      header: "User Details",
      cell: (row) => {
        const userFloat = row;
        const user = userFloat.user;
        const roleInfo = getFloatUserRoleInfo(user.role as UserRole);
        const floatStatus = getFloatStatus(
          userFloat.balance,
          userFloat.lastReconciliation
        );

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
                <Badge className={roleInfo.color}>
                  {roleInfo.icon} {roleInfo.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{user.email}</span>
                <Badge className={`${floatStatus.color} text-xs`}>
                  {floatStatus.icon} {floatStatus.label}
                </Badge>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: (row) => {
        const userFloat = row;
        const branch = userFloat.user.branch;
        return branch ? (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{branch.name}</span>
              <span className="text-sm text-gray-500">{branch.location}</span>
            </div>
          </div>
        ) : (
          <span className="text-gray-400 italic">No branch assigned</span>
        );
      },
    },
    {
      accessorKey: "balance",
      header: "Float Balance",
      cell: (row) => {
        const userFloat = row;
        const status = getFloatStatus(
          userFloat.balance,
          userFloat.lastReconciliation
        );
        return (
          <div className="flex flex-col">
            <span className="text-xl font-bold text-green-600">
              {formatCurrency(userFloat.balance)}
            </span>
            <div className="flex items-center gap-1 text-xs">
              <span className={`px-2 py-1 rounded ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "lastReconciliation",
      header: "Last Reconciliation",
      cell: (row) => {
        const userFloat = row;
        return userFloat.lastReconciliation ? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">
                {formatISODate(userFloat.lastReconciliation)}
              </span>
              <span className="text-sm text-gray-500">
                {format(new Date(userFloat.lastReconciliation), "HH:mm")}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-red-500 italic">Never reconciled</span>
        );
      },
    },
    {
      accessorKey: "id",
      header: "Actions",
      cell: (row) => {
        const userFloat = row;
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/floats/users/${userFloat.user.id}`)
              }
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          </div>
        );
      },
    },
  ];

  const transactionColumns: Column<FloatTransaction>[] = [
    {
      accessorKey: "float",
      header: "User",
      cell: (row) => {
        const t = row;
        const user = t.float.user;
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <span className="text-sm text-gray-500">{user.role}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Transaction Type",
      cell: (row) => {
        const t = row;
        const typeInfo = getFloatTransactionTypeInfo(t.type);
        return (
          <div className="flex items-center gap-2">
            <Badge className={typeInfo.color}>
              {typeInfo.icon} {typeInfo.label}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (row) => {
        const t = row;
        const isPositive = t.amount > 0;
        return (
          <span
            className={`font-medium text-lg ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {formatCurrency(t.amount)}
          </span>
        );
      },
    },
    {
      accessorKey: "transactionDate",
      header: "Date & Time",
      cell: (row) => {
        const t = row;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(t.transactionDate)}
            </span>
            <span className="text-sm text-gray-500">
              {format(new Date(t.transactionDate), "HH:mm:ss")}
            </span>
          </div>
        );
      },
    },
  ];

  const allocationColumns: Column<FloatAllocation>[] = [
    {
      accessorKey: "tellerAgent",
      header: "Recipient",
      cell: (row) => {
        const allocation = row;
        const agent = allocation.tellerAgent;
        const roleInfo = getFloatUserRoleInfo(agent.role as UserRole);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <User className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{agent.name}</span>
              <Badge className={`${roleInfo.color} text-xs w-fit`}>
                {roleInfo.icon} {roleInfo.label}
              </Badge>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: (row) => {
        const a = row;
        return (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{a.branch.name}</span>
              <span className="text-sm text-gray-500">{a.branch.location}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount Allocated",
      cell: (row) => (
        <span className="text-xl font-bold text-blue-600">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
  ];

  const reconciliationColumns: Column<FloatReconciliation>[] = [
    {
      accessorKey: "float",
      header: "User",
      cell: (row) => {
        const r = row;
        const user = r.float.user;
        return (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{user.name}</span>
              <span className="text-sm text-gray-500">{user.role}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "reconciledByUser",
      header: "Reconciliation Details",
      cell: (row) => {
        const r = row;
        const status = getReconciliationStatus(r.actualCash, r.systemBalance);
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge className={status.color}>
                {status.icon} {status.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">System: </span>
                <span className="font-medium">
                  {formatCurrency(r.systemBalance)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actual: </span>
                <span className="font-medium">
                  {formatCurrency(r.actualCash)}
                </span>
              </div>
            </div>
            {r.difference !== 0 && (
              <div className="text-sm">
                <span className="text-gray-500">Difference: </span>
                <span
                  className={`font-medium ${
                    r.difference > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {r.difference > 0 ? "+" : ""}
                  {formatCurrency(r.difference)}
                </span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "reconciliationDate",
      header: "Reconciliation Date",
      cell: (row) => {
        const r = row;
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(r.reconciliationDate)}
            </span>
            <span className="text-sm text-gray-500">
              by {r.reconciledByUser.name}
            </span>
          </div>
        );
      },
    },
  ];

  const exportUserFloats = async (filteredData: UserFloat[]) => {
    try {
      const exportData = filteredData.map((userFloat) => ({
        "User Name": userFloat.user.name,
        "User Email": userFloat.user.email,
        "User Role": userFloat.user.role,
        Branch: userFloat.user.branch?.name || "N/A",
        "Branch Location": userFloat.user.branch?.location || "N/A",
        "Current Balance": userFloat.balance,
        "Last Reconciliation": userFloat.lastReconciliation
          ? formatISODate(userFloat.lastReconciliation)
          : "Never",
        Status: getFloatStatus(userFloat.balance, userFloat.lastReconciliation)
          .label,
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "User Floats");
      const fileName = `User_Floats_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Export successful", {
        description: `User floats exported to ${fileName}`,
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Floats</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.totalFloats}
            </div>
            <p className="text-xs text-gray-500">
              Active: {statistics.activeFloats}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <span className="h-4 w-4 text-green-600">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(statistics.totalBalance)}
            </div>
            <p className="text-xs text-gray-500">Across all floats</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Reconciliations
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {statistics.pendingReconciliations}
            </div>
            <p className="text-xs text-gray-500">Need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Activity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {statistics.todayAllocations + statistics.todayReconciliations}
            </div>
            <p className="text-xs text-gray-500">
              {statistics.todayAllocations} allocations,{" "}
              {statistics.todayReconciliations} reconciliations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <FloatAllocationCreateForm
        isOpen={allocationModalOpen}
        onClose={() => setAllocationModalOpen(false)}
        currentUserId={currentUserId}
        totalBalance={statistics.totalBalance} // ← Add this line
      />

      <FloatReconciliationCreateForm
        isOpen={reconciliationModalOpen}
        onClose={() => setReconciliationModalOpen(false)}
        currentUserId={currentUserId}
      />

      {/* Tables */}
      <Tabs defaultValue="floats" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="floats">
            User Floats ({userFloats.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions ({floatTransactions.length})
          </TabsTrigger>
          <TabsTrigger value="allocations">
            Allocations ({floatAllocations.length})
          </TabsTrigger>
          <TabsTrigger value="reconciliations">
            Reconciliations ({floatReconciliations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="floats">
          <DataTable<UserFloat>
            title="User Float Balances"
            subtitle="Monitor individual user float balances and status"
            data={userFloats}
            columns={userFloatColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              // Accountant ONLY can allocate
              onAdd:
                userRole === "ACCOUNTANT"
                  ? () => setAllocationModalOpen(true)
                  : undefined,
              onExport: exportUserFloats,
            }}
            filters={{
              searchFields: ["user.name", "user.email", "user.branch.name"],
              enableDateFilter: false,
            }}
            renderRowActions={() => <TableActions.RowActions />}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <DataTable<FloatTransaction>
            title="Float Transactions"
            subtitle="All float-related transactions and movements"
            data={floatTransactions}
            columns={transactionColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            filters={{
              searchFields: [
                "float.user.name",
                "performedByUser.name",
                "description",
              ],
              enableDateFilter: true,
              getItemDate: (item) => item.transactionDate,
            }}
          />
        </TabsContent>

        <TabsContent value="allocations">
          <DataTable<FloatAllocation>
            title="Float Allocations"
            subtitle="Track float allocations to tellers and agents"
            data={floatAllocations}
            columns={allocationColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onAdd:
                userRole === "ACCOUNTANT"
                  ? () => setAllocationModalOpen(true)
                  : undefined,
            }}
            filters={{
              searchFields: ["tellerAgent.name", "branch.name"],
              enableDateFilter: true,
              getItemDate: (item) => item.allocationDate,
            }}
          />
        </TabsContent>

        <TabsContent value="reconciliations">
          <DataTable<FloatReconciliation>
            title="Float Reconciliations"
            subtitle="Track reconciliation history and discrepancies"
            data={floatReconciliations}
            columns={reconciliationColumns}
            keyField="id"
            isLoading={false}
            onRefresh={() => router.refresh()}
            actions={{
              onAdd: ["TELLER", "AGENT", "ADMIN", "BRANCHMANAGER"].includes(
                userRole
              )
                ? () => setReconciliationModalOpen(true)
                : undefined,
            }}
            filters={{
              searchFields: ["float.user.name", "reconciledByUser.name"],
              enableDateFilter: true,
              getItemDate: (item) => item.reconciliationDate,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
