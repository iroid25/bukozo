// @ts-nocheck
// app/dashboard/accountant/allocate-float/components/FloatAllocationListing.tsx
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
} from "lucide-react";

import { formatISODate } from "@/lib/utils";
import FloatAllocationCreateForm from "../../components/FloatAllocationForm";

interface FloatAllocation {
  id: string;
  amount: number;
  allocationDate: Date;
  description?: string;
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
    phone?: string;
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

export default function FloatAllocationListing({
  floatAllocations,
  eligibleUsers,
  branches,
  title,
  subtitle,
  statistics,
  currentUserId,
}: {
  floatAllocations: FloatAllocation[];
  eligibleUsers: EligibleUser[];
  branches: Branch[];
  title: string;
  subtitle: string;
  statistics: Statistics;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

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
        <Badge variant="outline" className="text-gray-600">
          No Float
        </Badge>
      );
    }

    if (user.floatStatus.pendingReconciliation) {
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

    if (!user.floatStatus.canStartNewDay) {
      return (
        <Badge className="bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-blue-600">
        Ready
      </Badge>
    );
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

  const handleAddNew = () => {
    setModalOpen(true);
  };

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

  return (
    <div className="container mx-auto py-6">
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
              <div>
                <p className="font-medium text-orange-800">
                  {statistics.pendingReconciliations} teller(s) have pending
                  end-of-day reconciliations
                </p>
                <p className="text-sm text-orange-600">
                  Review and approve reconciliations before allocating new float
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eligible Users Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Eligible Tellers & Agents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eligibleUsers.slice(0, 6).map((user) => (
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
          {eligibleUsers.length > 6 && (
            <p className="text-sm text-gray-500 text-center mt-4">
              And {eligibleUsers.length - 6} more...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal for Creating Float Allocation */}
      <FloatAllocationCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={currentUserId}
        eligibleUsers={eligibleUsers}
        branches={branches}
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
