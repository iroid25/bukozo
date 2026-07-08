// // app/dashboard/accountant/components/FloatAllocationListing.tsx
// "use client";
// import { useState } from "react";
// import * as XLSX from "xlsx";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";

// import { Column, DataTable } from "@/components/ui/data-table";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import {
//   User,
//   Building,
//   DollarSign,
//   TrendingUp,
//   Clock,
//   AlertTriangle,
//   CheckCircle,
//   Users2,
//   Wallet,
// } from "lucide-react";

// import { formatISODate } from "@/lib/utils";
// import FloatAllocationCreateForm from "./FloatAllocationForm";

// // Define interfaces
// interface FloatAllocation {
//   id: string;
//   amount: number;
//   allocationDate: Date;
//   description?: string | null;
//   branch: {
//     id: string;
//     name: string;
//     location: string;
//   };
//   tellerAgent: {
//     id: string;
//     name: string;
//     role: string;
//     email: string;
//     phone?: string | null;
//   };
//   allocatedByUser: {
//     id: string;
//     name: string;
//     role: string;
//   };
// }

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

// interface Statistics {
//   totalAllocations: number;
//   totalAmount: number;
//   todayAllocations: number;
//   todayAmount: number;
//   activeTellers: number;
//   pendingReconciliations: number;
// }

// interface FloatAllocationListingProps {
//   floatAllocations: FloatAllocation[];
//   eligibleUsers: EligibleUser[];
//   branches: Branch[];
//   title: string;
//   subtitle: string;
//   statistics: Statistics;
//   currentUserId: string;
// }

// export default function FloatAllocationListing({
//   floatAllocations,
//   eligibleUsers,
//   branches,
//   title,
//   subtitle,
//   statistics,
//   currentUserId,
// }: FloatAllocationListingProps) {
//   const router = useRouter();
//   const [modalOpen, setModalOpen] = useState(false);

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const getUserFloatStatusBadge = (user: EligibleUser) => {
//     if (!user.floatStatus) {
//       return (
//         <Badge variant="outline" className="text-gray-600">
//           No Float
//         </Badge>
//       );
//     }

//     if (user.floatStatus.pendingReconciliation) {
//       return (
//         <Badge className="bg-orange-100 text-orange-700">
//           <Clock className="h-3 w-3 mr-1" />
//           Pending EOD
//         </Badge>
//       );
//     }

//     if (user.floatStatus.isActiveForDay) {
//       return (
//         <Badge className="bg-green-100 text-green-700">
//           <CheckCircle className="h-3 w-3 mr-1" />
//           Active
//         </Badge>
//       );
//     }

//     if (!user.floatStatus.canStartNewDay) {
//       return (
//         <Badge className="bg-red-100 text-red-700">
//           <AlertTriangle className="h-3 w-3 mr-1" />
//           Blocked
//         </Badge>
//       );
//     }

//     return (
//       <Badge variant="outline" className="text-blue-600">
//         Ready
//       </Badge>
//     );
//   };

//   const columns: Column<FloatAllocation>[] = [
//     {
//       accessorKey: "tellerAgent",
//       header: "Recipient",
//       cell: (row) => {
//         const allocation = row;
//         const agent = allocation.tellerAgent;

//         return (
//           <div className="flex items-center gap-3">
//             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
//               <User className="h-5 w-5" />
//             </div>
//             <div className="flex flex-col">
//               <span className="font-medium">{agent.name}</span>
//               <div className="flex items-center gap-2 text-sm text-gray-500">
//                 <span>{agent.email}</span>
//                 <Badge variant="outline" className="text-xs">
//                   {agent.role}
//                 </Badge>
//               </div>
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
//           <div className="flex items-center gap-2">
//             <DollarSign className="h-4 w-4 text-green-600" />
//             <span className="text-xl font-bold text-green-700">
//               {formatCurrency(allocation.amount)}
//             </span>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "allocationDate",
//       header: "Allocation Date",
//       cell: (row) => {
//         const allocation = row;

//         return (
//           <div className="flex flex-col">
//             <span className="font-medium">
//               {formatISODate(allocation.allocationDate)}
//             </span>
//             <span className="text-sm text-gray-500">
//               {format(new Date(allocation.allocationDate), "HH:mm")}
//             </span>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "allocatedByUser",
//       header: "Allocated By",
//       cell: (row) => {
//         const allocation = row;

//         return (
//           <div className="flex flex-col">
//             <span className="font-medium">
//               {allocation.allocatedByUser.name}
//             </span>
//             <Badge variant="outline" className="text-xs w-fit">
//               {allocation.allocatedByUser.role}
//             </Badge>
//           </div>
//         );
//       },
//     },
//     {
//       accessorKey: "description",
//       header: "Description",
//       cell: (row) => {
//         const allocation = row;
//         return (
//           <span className="text-sm text-gray-600">
//             {allocation.description || "No description"}
//           </span>
//         );
//       },
//     },
//   ];

//   const handleAddNew = () => {
//     setModalOpen(true);
//   };

//   const handleExport = async (filteredAllocations: FloatAllocation[]) => {
//     try {
//       const exportData = filteredAllocations.map((allocation) => ({
//         "Allocation ID": allocation.id,
//         "Recipient Name": allocation.tellerAgent.name,
//         "Recipient Email": allocation.tellerAgent.email,
//         "Recipient Role": allocation.tellerAgent.role,
//         "Branch Name": allocation.branch.name,
//         "Branch Location": allocation.branch.location,
//         "Amount Allocated": allocation.amount,
//         "Allocation Date": formatISODate(allocation.allocationDate),
//         "Allocation Time": format(
//           new Date(allocation.allocationDate),
//           "HH:mm:ss"
//         ),
//         "Allocated By": allocation.allocatedByUser.name,
//         Description: allocation.description || "N/A",
//       }));

//       const worksheet = XLSX.utils.json_to_sheet(exportData);
//       const workbook = XLSX.utils.book_new();
//       XLSX.utils.book_append_sheet(workbook, worksheet, "Float Allocations");

//       const fileName = `Float_Allocations_${format(
//         new Date(),
//         "yyyy-MM-dd"
//       )}.xlsx`;

//       XLSX.writeFile(workbook, fileName);

//       toast.success("Export successful", {
//         description: `Float allocations exported to ${fileName}`,
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
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
//         <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Total Allocations
//             </CardTitle>
//             <Wallet className="h-5 w-5 text-blue-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-blue-700">
//               {statistics.totalAllocations}
//             </div>
//             <p className="text-xs text-blue-600 mt-1">
//               Total: {formatCurrency(statistics.totalAmount)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card className="bg-gradient-to-r from-green-50 to-green-100">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Today's Allocations
//             </CardTitle>
//             <TrendingUp className="h-5 w-5 text-green-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-green-700">
//               {statistics.todayAllocations}
//             </div>
//             <p className="text-xs text-green-600 mt-1">
//               Amount: {formatCurrency(statistics.todayAmount)}
//             </p>
//           </CardContent>
//         </Card>

//         <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">Active Status</CardTitle>
//             <Users2 className="h-5 w-5 text-purple-600" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold text-purple-700">
//               {statistics.activeTellers}
//             </div>
//             <p className="text-xs text-purple-600 mt-1">
//               Active tellers/agents today
//             </p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Pending Reconciliations Alert */}
//       {statistics.pendingReconciliations > 0 && (
//         <Card className="mb-6 bg-orange-50 border-orange-200">
//           <CardContent className="p-4">
//             <div className="flex items-center gap-3">
//               <AlertTriangle className="h-5 w-5 text-orange-600" />
//               <div>
//                 <p className="font-medium text-orange-800">
//                   {statistics.pendingReconciliations} teller(s) have pending
//                   end-of-day reconciliations
//                 </p>
//                 <p className="text-sm text-orange-600">
//                   Review and approve reconciliations before allocating new float
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       )}

//       {/* Eligible Users Overview */}
//       <Card className="mb-6">
//         <CardHeader>
//           <CardTitle>Eligible Tellers & Agents</CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {eligibleUsers.slice(0, 6).map((user) => (
//               <div
//                 key={user.id}
//                 className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
//               >
//                 <div className="flex items-center gap-3">
//                   <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
//                     <User className="h-5 w-5 text-gray-600" />
//                   </div>
//                   <div>
//                     <p className="font-medium text-sm">{user.name}</p>
//                     <p className="text-xs text-gray-500">{user.role}</p>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   {getUserFloatStatusBadge(user)}
//                   {user.floatStatus && (
//                     <p className="text-xs text-gray-600 mt-1">
//                       {formatCurrency(user.floatStatus.balance)}
//                     </p>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//           {eligibleUsers.length > 6 && (
//             <p className="text-sm text-gray-500 text-center mt-4">
//               And {eligibleUsers.length - 6} more...
//             </p>
//           )}
//         </CardContent>
//       </Card>

//       {/* Modal for Creating Float Allocation */}
//       <FloatAllocationCreateForm
//         isOpen={modalOpen}
//         onClose={() => setModalOpen(false)}
//         currentUserId={currentUserId}
//         eligibleUsers={eligibleUsers}
//         branches={branches}
//       />

//       {/* Data Table */}
//       <DataTable<FloatAllocation>
//         title={title}
//         subtitle={subtitle}
//         data={floatAllocations}
//         columns={columns}
//         keyField="id"
//         isLoading={false}
//         onRefresh={() => router.refresh()}
//         actions={{
//           onAdd: handleAddNew,
//           onExport: handleExport,
//         }}
//         filters={{
//           searchFields: [
//             "tellerAgent.name",
//             "tellerAgent.email",
//             "branch.name",
//             "allocatedByUser.name",
//           ],
//           enableDateFilter: true,
//           getItemDate: (item) => item.allocationDate,
//         }}
//       />
//     </div>
//   );
// }
/// app/dashboard/accountant/allocate-float/floattwo/FloatAllocationListing.tsx
// accountant/vault
// accounts/vault
// app/dashboard/accountant/allocate-float/floattwo/FloatAllocationListing.tsx
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Building,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users2,
  Wallet,
  XCircle,
  Info,
  Vault,
  AlertCircle,
  ArrowLeftRight,
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import FloatAllocationCreateForm from "./FloatAllocationForm";
import ProposeReturnModal from "../../accounts/vault/components/ProposeReturnModal";

// Define interfaces
interface FloatAllocation {
  id: string;
  amount: number;
  allocationDate: Date;
  description?: string | null;
  branch: {
    id: string;
    name: string;
    location: string;
  };
  tellerAgent: {
    id: string;
    name: string;
    role: string;
    email: string | null;
    phone?: string | null;
  };
  allocatedByUser: {
    id: string;
    name: string;
    role: string;
  };
}

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
    hasPendingReconciliation: boolean;
    isEligible: boolean;
    ineligibilityReason: string | null;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface Statistics {
  totalAllocations: number;
  totalAmount: number;
  todayAllocations: number;
  todayAmount: number;
  activeTellers: number;
  pendingReconciliations: number;
}

interface FloatAllocationListingProps {
  floatAllocations: FloatAllocation[];
  eligibleUsers: EligibleUser[];
  branches: Branch[];
  title: string;
  subtitle: string;
  statistics: Statistics;
  currentUserId: string;
  pendingReconciliations: any[];
  vaultBalance: number;
  vaultId?: string;
  vaultData?: any;
  orgReserveId?: string;
}

export default function FloatAllocationListing({
  floatAllocations,
  eligibleUsers,
  branches,
  title,
  subtitle,
  statistics,
  currentUserId,
  pendingReconciliations,
  vaultBalance,
  vaultId,
  vaultData,
  orgReserveId,
}: FloatAllocationListingProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getUserFloatStatusBadge = (user: EligibleUser) => {
    if (!user.floatStatus) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready (New)
        </Badge>
      );
    }

    if (!user.floatStatus.isEligible) {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-300">
          <XCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    }

    if (
      user.floatStatus.hasPendingReconciliation ||
      user.floatStatus.pendingReconciliation
    ) {
      return (
        <Badge className="bg-orange-100 text-orange-700">
          <Clock className="h-3 w-3 mr-1" />
          Pending EOD
        </Badge>
      );
    }

    if (user.floatStatus.isActiveForDay) {
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }

    if (user.floatStatus.balance === 0 && !user.floatStatus.isActiveForDay) {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-gray-600">
        Available
      </Badge>
    );
  };

  const handleAddNew = () => {
    if (vaultBalance <= 0) {
      toast.error("Vault Balance Empty", {
        description:
          "Cannot allocate float. Vault balance is insufficient. Contact accountant.",
      });
      return;
    }
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    // Refresh on close to catch any updates
    setTimeout(() => {
      router.refresh();
    }, 300);
  };

  const columns: Column<FloatAllocation>[] = [
    {
      accessorKey: "tellerAgent",
      header: "Recipient",
      cell: (row) => {
        const allocation = row;
        const agent = allocation.tellerAgent;

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium">{agent.name}</span>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{agent.email}</span>
                <Badge variant="outline" className="text-xs">
                  {agent.role}
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
        const allocation = row;

        return (
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500" />
            <div className="flex flex-col">
              <span className="font-medium">{allocation.branch.name}</span>
              <span className="text-sm text-gray-500">
                {allocation.branch.location}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount Allocated",
      cell: (row) => {
        const allocation = row;

        return (
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xl font-bold text-green-700">
              {formatCurrency(allocation.amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "allocationDate",
      header: "Allocation Date",
      cell: (row) => {
        const allocation = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatISODate(allocation.allocationDate)}
            </span>
            <span className="text-sm text-gray-500">
              {format(new Date(allocation.allocationDate), "HH:mm")}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "allocatedByUser",
      header: "Allocated By",
      cell: (row) => {
        const allocation = row;

        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {allocation.allocatedByUser.name}
            </span>
            <Badge variant="outline" className="text-xs w-fit">
              {allocation.allocatedByUser.role}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (row) => {
        const allocation = row;
        return (
          <span className="text-sm text-gray-600">
            {allocation.description || "No description"}
          </span>
        );
      },
    },
  ];

  const handleExport = async (filteredAllocations: FloatAllocation[]) => {
    try {
      const exportData = filteredAllocations.map((allocation) => ({
        "Allocation ID": allocation.id,
        "Recipient Name": allocation.tellerAgent.name,
        "Recipient Email": allocation.tellerAgent.email,
        "Recipient Role": allocation.tellerAgent.role,
        "Branch Name": allocation.branch.name,
        "Branch Location": allocation.branch.location,
        "Amount Allocated": allocation.amount,
        "Allocation Date": formatISODate(allocation.allocationDate),
        "Allocation Time": format(
          new Date(allocation.allocationDate),
          "HH:mm:ss"
        ),
        "Allocated By": allocation.allocatedByUser.name,
        Description: allocation.description || "N/A",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Float Allocations");

      const fileName = `Float_Allocations_${format(
        new Date(),
        "yyyy-MM-dd"
      )}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast.success("Export successful", {
        description: `Float allocations exported to ${fileName}`,
      });
    } catch (error) {
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  };

  const eligibleUsersList = eligibleUsers.filter(
    (u) => !u.floatStatus || u.floatStatus.isEligible
  );
  const blockedUsersList = eligibleUsers.filter(
    (u) => u.floatStatus && !u.floatStatus.isEligible
  );

  const hasVault = Boolean(vaultData?.id);
  const vaultLowBalance = hasVault && vaultBalance < 500000;
  const vaultCritical = hasVault && vaultBalance < 100000;

  return (
    <div className="container mx-auto py-6">
      {/* Vault Balance Alert Card */}
      <Card
        className={`mb-6 ${
          !hasVault
            ? "bg-red-50 border-red-300"
            : vaultCritical
              ? "bg-red-50 border-red-300"
              : vaultLowBalance
                ? "bg-orange-50 border-orange-300"
                : "bg-green-50 border-green-300"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  vaultCritical
                    ? "bg-red-100"
                    : vaultLowBalance
                      ? "bg-orange-100"
                      : "bg-green-100"
                }`}
              >
                <Vault
                  className={`h-6 w-6 ${
                    vaultCritical
                      ? "text-red-600"
                      : vaultLowBalance
                        ? "text-orange-600"
                        : "text-green-600"
                  }`}
                />
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    !hasVault
                      ? "text-red-900"
                      : vaultCritical
                      ? "text-red-900"
                      : vaultLowBalance
                        ? "text-orange-900"
                        : "text-green-900"
                  }`}
                >
                  {hasVault ? "Branch Reserve Balance" : "No Active Branch Reserve"}
                </p>
                <p className="text-2xl font-bold">
                  {hasVault ? formatCurrency(vaultBalance) : "Unavailable"}
                </p>
              </div>
            </div>
            <div className="text-right">
              {!hasVault ? (
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Reserve Missing</span>
                </div>
              ) : vaultCritical ? (
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Critical</span>
                </div>
              ) : vaultLowBalance ? (
                <div className="flex items-center gap-2 text-orange-600 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Low Balance</span>
                </div>
              ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/accounts/vault")}
                >
                  View Vault
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setReturnModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 ml-2"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Propose Return
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Allocations
              </CardTitle>
              <Wallet className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">
                {statistics.totalAllocations}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Total: {formatCurrency(statistics.totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-50 to-green-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Allocations
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                {statistics.todayAllocations}
              </div>
              <p className="text-xs text-green-600 mt-1">
                Amount: {formatCurrency(statistics.todayAmount)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Status</CardTitle>
              <Users2 className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {statistics.activeTellers}
              </div>
              <p className="text-xs text-purple-600 mt-1">
                Active tellers/agents today
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Reconciliations Alert */}
        {statistics.pendingReconciliations > 0 && (
          <Card className="mb-6 bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div className="flex-1">
                  <p className="font-medium text-orange-800">
                    {statistics.pendingReconciliations} teller(s) have pending
                    end-of-day reconciliations
                  </p>
                  <p className="text-sm text-orange-600">
                    Review and approve reconciliations before allocating new float
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push("/dashboard/floats/distribution/reconciliations")
                  }
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  View Reconciliations
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Blocked Users Alert */}
        {blockedUsersList.length > 0 && (
          <Card className="mb-6 bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">
                    {blockedUsersList.length} user(s) blocked from receiving float
                  </p>
                  <div className="mt-2 space-y-1">
                    {blockedUsersList.slice(0, 3).map((user) => (
                      <div key={user.id} className="text-sm text-red-600">
                        • {user.name}: {user.floatStatus?.ineligibilityReason}
                      </div>
                    ))}
                    {blockedUsersList.length > 3 && (
                      <p className="text-sm text-red-600 italic">
                        And {blockedUsersList.length - 3} more...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Eligible Users Overview */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Eligible Tellers & Agents</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {eligibleUsersList.length} user(s) ready for float allocation
                </p>
              </div>
              {blockedUsersList.length > 0 && (
                <Badge variant="outline" className="text-red-600">
                  {blockedUsersList.length} blocked
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {eligibleUsersList.slice(0, 6).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <User className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getUserFloatStatusBadge(user)}
                    {user.floatStatus && (
                      <p className="text-xs text-gray-600 mt-1">
                        {formatCurrency(user.floatStatus.balance)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {eligibleUsersList.length > 6 && (
              <p className="text-sm text-gray-500 text-center mt-4">
                And {eligibleUsersList.length - 6} more...
              </p>
            )}
            {eligibleUsersList.length === 0 && (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  No eligible users available for float allocation
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  All users either have pending reconciliations or need EOD
                  approval
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal for Creating Float Allocation */}
        <FloatAllocationCreateForm
          isOpen={modalOpen}
          onClose={handleModalClose}
          currentUserId={currentUserId}
          eligibleUsers={eligibleUsersList}
          branches={branches}
          vaultBalance={vaultBalance}
          vaultId={vaultId}
          vaultData={vaultData}
        />

        {/* Modal for Proposing Reserve Return */}
        <ProposeReturnModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          branchVault={vaultData || { id: vaultId, balance: vaultBalance }}
          orgReserveId={orgReserveId || ""}
        />

        {/* Data Table */}
        <DataTable<FloatAllocation>
          title={title}
          subtitle={subtitle}
          data={floatAllocations}
          columns={columns}
          keyField="id"
          isLoading={false}
          onRefresh={() => router.refresh()}
          actions={{
            onAdd: handleAddNew,
            onExport: handleExport,
          }}
          filters={{
            searchFields: [
              "tellerAgent.name",
              "tellerAgent.email",
              "branch.name",
              "allocatedByUser.name",
            ],
            enableDateFilter: true,
            getItemDate: (item) => item.allocationDate,
          }}
        />
      </div>
    );
}
