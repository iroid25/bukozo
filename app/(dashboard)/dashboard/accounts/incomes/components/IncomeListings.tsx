"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import IncomeRecordForm from "../new/IncomeRecordForm";
import IncomeCategoryTree from "./IncomeCategoryTree";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Statistics,
  IncomeRecordWithRelations,
  SimpleMember,
  SimpleAccount,
  SimpleBudgetCategory,
  SimpleBranch,
  SimpleInstitution,
} from "@/types/incomes";

interface IncomeListingProps {
  title: string;
  subtitle: string;
  incomeRecords: IncomeRecordWithRelations[];
  statistics: Statistics;
  userRole: string;
  userId: string;
  categories: SimpleBudgetCategory[];
  branches: SimpleBranch[];
  members: SimpleMember[];
  institutions: SimpleInstitution[];
  accounts: SimpleAccount[];
  onRefresh?: () => void;
}

export function IncomeListing({
  title,
  subtitle,
  incomeRecords,
  statistics,
  userRole,
  userId,
  categories,
  branches,
  members,
  institutions,
  accounts,
  onRefresh,
}: IncomeListingProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<IncomeRecordWithRelations | null>(
    null
  );
  const [selectedRecord, setSelectedRecord] =
    useState<IncomeRecordWithRelations | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle create new income
  const handleCreate = () => {
    setEditData(null);
    setShowForm(true);
  };

  // Handle edit income
  const handleEdit = (record: IncomeRecordWithRelations) => {
    setEditData(record);
    setShowForm(true);
  };

  // Handle delete confirmation
  const handleDeleteClick = (record: IncomeRecordWithRelations) => {
    setSelectedRecord(record);
    setShowDeleteDialog(true);
  };

  // Handle actual delete using server action
  const handleDelete = async () => {
    if (!selectedRecord) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/income?id=${selectedRecord.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || result.error) {
        alert(result.error || "Failed to delete income record");
      } else {
        setShowDeleteDialog(false);
        setSelectedRecord(null);
        if (onRefresh) {
          onRefresh();
        } else {
          router.refresh();
        }
      }
    } catch (error) {
      console.error("Error deleting income record:", error);
      alert("Failed to delete income record");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle form close
  const handleFormClose = () => {
    setShowForm(false);
    setEditData(null);
    if (onRefresh) {
      onRefresh();
    } else {
      router.refresh();
    }
  };

  // Handle view details
  const handleView = (record: IncomeRecordWithRelations) => {
    router.push(`/dashboard/accounts/incomes/${record.id}`);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-UG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Add Income
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            Total Income
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statistics.totalRecords} records
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            Today's Income
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.todayIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {statistics.todayRecords} records today
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            This Month
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.thisMonthIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Monthly total</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">
            Average Income
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(statistics.averageIncome)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
        </div>
      </div>

      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Data Table</TabsTrigger>
          <TabsTrigger value="visualise">Visualise</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-0">
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Payment Method
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Branch
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Member / Institution
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Received By
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incomeRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No income records found
                      </td>
                    </tr>
                  ) : (
                    incomeRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
                          {formatDate(record.recordDate)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.budgetCategory?.name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {formatCurrency(record.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.paymentMethod || "CASH"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.branch?.name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.member?.user?.name || record.depositorName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.receivedBy?.name || "N/A"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              record.status === "COMPLETED" ||
                              record.status === "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : record.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleView(record)}
                              className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              View
                            </button>
                            {(userRole === "ADMIN" ||
                              userRole === "ACCOUNTANT") && (
                              <>
                                <button
                                  onClick={() => handleEdit(record)}
                                  className="px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:underline transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(record)}
                                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:underline transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visualise" className="space-y-0">
          <IncomeCategoryTree
            categories={categories}
            breakdown={statistics.categoryBreakdown}
          />
        </TabsContent>
      </Tabs>

      {/* Income Form - Using IncomeRecordForm Component */}
      <IncomeRecordForm
        isOpen={showForm}
        onClose={handleFormClose}
        categories={categories}
        branches={branches}
        members={members}
        institutions={institutions}
        accounts={accounts}
        userId={userId}
        userRole={userRole}
        editData={
          editData
            ? {
                id: editData.id,
                categoryId:
                  editData.budgetCategoryId ||
                  editData.budgetCategory?.id ||
                  "",
                amount: editData.amount,
                recordDate:
                  typeof editData.recordDate === "string"
                    ? editData.recordDate
                    : editData.recordDate.toISOString().slice(0, 10),
                description: editData.description ?? "",
                branchId: editData.branchId ?? editData.branch?.id,
                memberId: editData.memberId ?? editData.member?.id,
                accountId: editData.accountId ?? editData.account?.id,
                receiptNo: editData.receiptNo ?? editData.receiptNumber ?? "",
                externalRef:
                  editData.externalRef ?? editData.referenceNumber ?? "",
                paymentMethod: editData.paymentMethod ?? "CASH",
                depositorName: editData.depositorName ?? "",
                depositorContact: editData.depositorContact ?? "",
                notes: editData.notes ?? "",
              }
            : null
        }
        isEditMode={!!editData}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-red-600">
              Confirm Delete
            </h2>
            <p className="text-muted-foreground mb-2">
              Are you sure you want to delete this income record?
            </p>
            <div className="bg-muted p-4 rounded-md mb-6">
              <p className="text-sm">
                <strong>Amount:</strong> {formatCurrency(selectedRecord.amount)}
              </p>
              <p className="text-sm">
                <strong>Category:</strong>{" "}
                {selectedRecord.budgetCategory?.name || "N/A"}
              </p>
              <p className="text-sm">
                <strong>Date:</strong> {formatDate(selectedRecord.recordDate)}
              </p>
              <p className="text-sm">
                <strong>Receipt:</strong> {selectedRecord.receiptNo}
              </p>
            </div>
            <p className="text-sm text-red-600 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedRecord(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
