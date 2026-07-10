"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FilterX, Search } from "lucide-react";
import IncomeRecordForm from "../new/IncomeRecordForm";
import IncomeCategoryTree from "./IncomeCategoryTree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type IncomeFilters = {
  query: string;
  categoryId: string;
  paymentMethod: string;
  status: string;
  branchId: string;
  fromDate: string;
  toDate: string;
  minAmount: string;
  maxAmount: string;
  pageSize: number;
};

const DEFAULT_FILTERS: IncomeFilters = {
  query: "",
  categoryId: "all",
  paymentMethod: "all",
  status: "all",
  branchId: "all",
  fromDate: "",
  toDate: "",
  minAmount: "",
  maxAmount: "",
  pageSize: 10,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateOnly(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeString(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function recordText(record: IncomeRecordWithRelations) {
  return [
    record.recordDate ? formatDate(record.recordDate) : "",
    record.budgetCategory?.name,
    record.budgetCategory?.code,
    record.amount,
    record.paymentMethod,
    record.branch?.name,
    record.branch?.location,
    record.member?.user?.name,
    record.member?.memberNumber,
    record.account?.accountNumber,
    record.receivedBy?.name,
    record.status,
    record.receiptNo,
    record.receiptNumber,
    record.referenceNumber,
    record.externalRef,
    record.depositorName,
    record.depositorContact,
    record.description,
    record.notes,
  ]
    .filter(Boolean)
    .map((value) => safeString(value))
    .join(" ");
}

function buildFilteredStatistics(records: IncomeRecordWithRelations[]): Statistics {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const totalIncome = records.reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const todayIncome = records.reduce((sum, record) => {
    const date = new Date(record.recordDate);
    date.setHours(0, 0, 0, 0);
    return sum + (date.getTime() === today.getTime() ? Number(record.amount || 0) : 0);
  }, 0);
  const thisMonthIncome = records.reduce((sum, record) => {
    const date = new Date(record.recordDate);
    return sum + (date >= monthStart ? Number(record.amount || 0) : 0);
  }, 0);

  const categoryMap = new Map<
    string,
    { categoryId: string; categoryName: string; parentName?: string; count: number; amount: number }
  >();
  const branchMap = new Map<string | null, { branchId: string | null; branchName: string; count: number; amount: number }>();
  const paymentMap = new Map<string, { method: any; count: number; amount: number }>();

  for (const record of records) {
    const categoryId = record.budgetCategory?.id || record.budgetCategoryId || "";
    const categoryName = record.budgetCategory?.name || "Unknown";
    const parentName = record.budgetCategory?.parent?.name;
    const amount = Number(record.amount || 0);

    const currentCategory = categoryMap.get(categoryId) || {
      categoryId,
      categoryName,
      parentName,
      count: 0,
      amount: 0,
    };
    currentCategory.count += 1;
    currentCategory.amount += amount;
    categoryMap.set(categoryId, currentCategory);

    const branchId = record.branchId || null;
    const branchName = record.branch?.name || "No Branch";
    const currentBranch = branchMap.get(branchId) || {
      branchId,
      branchName,
      count: 0,
      amount: 0,
    };
    currentBranch.count += 1;
    currentBranch.amount += amount;
    branchMap.set(branchId, currentBranch);

    const method = String(record.paymentMethod || "UNKNOWN");
    const currentMethod = paymentMap.get(method) || {
      method: record.paymentMethod,
      count: 0,
      amount: 0,
    };
    currentMethod.count += 1;
    currentMethod.amount += amount;
    paymentMap.set(method, currentMethod);
  }

  return {
    totalIncome,
    todayIncome,
    thisMonthIncome,
    totalRecords: records.length,
    todayRecords: records.filter((record) => {
      const date = new Date(record.recordDate);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime();
    }).length,
    averageIncome: records.length > 0 ? totalIncome / records.length : 0,
    categoryBreakdown: Array.from(categoryMap.values()).sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
    branchBreakdown: Array.from(branchMap.values()).sort((a, b) => a.branchName.localeCompare(b.branchName)),
    paymentMethodBreakdown: Array.from(paymentMap.values()).sort((a, b) => String(a.method).localeCompare(String(b.method))),
  };
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
  const [editData, setEditData] = useState<IncomeRecordWithRelations | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IncomeRecordWithRelations | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState<IncomeFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  const setFilter = <K extends keyof IncomeFilters>(key: K, value: IncomeFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  const handleCreate = () => {
    setEditData(null);
    setShowForm(true);
  };

  const handleEdit = (record: IncomeRecordWithRelations) => {
    setEditData(record);
    setShowForm(true);
  };

  const handleDeleteClick = (record: IncomeRecordWithRelations) => {
    setSelectedRecord(record);
    setShowDeleteDialog(true);
  };

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
        onRefresh ? onRefresh() : router.refresh();
      }
    } catch (error) {
      console.error("Error deleting income record:", error);
      alert("Failed to delete income record");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditData(null);
    onRefresh ? onRefresh() : router.refresh();
  };

  const handleView = (record: IncomeRecordWithRelations) => {
    router.push(`/dashboard/accounts/incomes/${record.id}`);
  };

  const filteredRecords = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
    const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;
    const fromDate = toDateOnly(filters.fromDate);
    const toDate = toDateOnly(filters.toDate);

    return incomeRecords.filter((record) => {
      if (filters.categoryId !== "all") {
        const categoryId = record.budgetCategory?.id || record.budgetCategoryId || "";
        if (categoryId !== filters.categoryId) return false;
      }

      if (filters.paymentMethod !== "all" && String(record.paymentMethod) !== filters.paymentMethod) {
        return false;
      }

      if (filters.status !== "all" && String(record.status) !== filters.status) {
        return false;
      }

      if (filters.branchId !== "all" && record.branch?.id !== filters.branchId) {
        return false;
      }

      const recordDate = new Date(record.recordDate);
      if (fromDate && recordDate < fromDate) return false;
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        if (recordDate > endDate) return false;
      }

      if (minAmount != null && Number(record.amount || 0) < minAmount) return false;
      if (maxAmount != null && Number(record.amount || 0) > maxAmount) return false;

      if (query && !recordText(record).includes(query)) {
        return false;
      }

      return true;
    });
  }, [filters, incomeRecords]);

  const filteredStatistics = useMemo(() => buildFilteredStatistics(filteredRecords), [filteredRecords]);

  const filteredBreakdown = useMemo(() => filteredStatistics.categoryBreakdown, [filteredStatistics]);

  const categoryOptions = useMemo(() => {
    return categories
      .map((category) => ({
        id: category.id,
        label: `${category.code ? `${category.code} - ` : ""}${category.name}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [categories]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch) => map.set(branch.id, branch.name));
    filteredRecords.forEach((record) => {
      if (record.branch?.id && record.branch?.name) {
        map.set(record.branch.id, record.branch.name);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [branches, filteredRecords]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(incomeRecords.map((record) => String(record.status))))
      .filter(Boolean)
      .sort();
  }, [incomeRecords]);

  const paymentMethodOptions = useMemo(() => {
    return Array.from(new Set(incomeRecords.map((record) => String(record.paymentMethod))))
      .filter(Boolean)
      .sort();
  }, [incomeRecords]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / filters.pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * filters.pageSize;
  const pageEnd = pageStart + filters.pageSize;
  const paginatedRecords = filteredRecords.slice(pageStart, pageEnd);
  const showingStart = filteredRecords.length === 0 ? 0 : pageStart + 1;
  const showingEnd = Math.min(pageEnd, filteredRecords.length);

  const formatTotal = (value: number) => formatCurrency(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Add Income
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Filtered Income</div>
          <div className="text-2xl font-bold">{formatTotal(filteredStatistics.totalIncome)}</div>
          <p className="text-xs text-muted-foreground mt-1">{filteredStatistics.totalRecords} filtered records</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Filtered Today</div>
          <div className="text-2xl font-bold">{formatTotal(filteredStatistics.todayIncome)}</div>
          <p className="text-xs text-muted-foreground mt-1">{filteredStatistics.todayRecords} records today</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Filtered This Month</div>
          <div className="text-2xl font-bold">{formatTotal(filteredStatistics.thisMonthIncome)}</div>
          <p className="text-xs text-muted-foreground mt-1">Monthly total</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Average Income</div>
          <div className="text-2xl font-bold">{formatTotal(filteredStatistics.averageIncome)}</div>
          <p className="text-xs text-muted-foreground mt-1">Per filtered transaction</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.query}
                onChange={(event) => setFilter("query", event.target.value)}
                className="pl-9"
                placeholder="Search date, category, amount, member, branch, receipt..."
              />
            </div>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <Select value={filters.categoryId} onValueChange={(value) => setFilter("categoryId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Payment</label>
            <Select value={filters.paymentMethod} onValueChange={(value) => setFilter("paymentMethod", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethodOptions.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
            <Select value={filters.status} onValueChange={(value) => setFilter("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Branch</label>
            <Select value={filters.branchId} onValueChange={(value) => setFilter("branchId", value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branchOptions.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={filters.fromDate} onChange={(event) => setFilter("fromDate", event.target.value)} />
          </div>

          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={filters.toDate} onChange={(event) => setFilter("toDate", event.target.value)} />
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Min Amount</label>
            <Input type="number" value={filters.minAmount} onChange={(event) => setFilter("minAmount", event.target.value)} placeholder="0" />
          </div>

          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max Amount</label>
            <Input type="number" value={filters.maxAmount} onChange={(event) => setFilter("maxAmount", event.target.value)} placeholder="Any" />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" variant="outline" onClick={handleResetFilters} className="gap-2">
              <FilterX className="h-4 w-4" />
              Reset Filters
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing {filteredRecords.length} filtered records. The table and visualise totals use the same filtered dataset.
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
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Payment Method</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Branch</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Member / Institution</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Received By</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        No income records found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((record) => {
                      const isJournalFallback = record.id.startsWith("journal-");

                      return (
                        <tr key={record.id} className="border-b transition-colors hover:bg-muted/50">
                          <td className="px-4 py-3 text-sm">{formatDate(record.recordDate)}</td>
                          <td className="px-4 py-3 text-sm">{record.budgetCategory?.name || "N/A"}</td>
                          <td className="px-4 py-3 text-sm font-medium">{formatCurrency(record.amount)}</td>
                          <td className="px-4 py-3 text-sm">{record.paymentMethod || "CASH"}</td>
                          <td className="px-4 py-3 text-sm">{record.branch?.name || "N/A"}</td>
                          <td className="px-4 py-3 text-sm">{record.member?.user?.name || record.depositorName || "N/A"}</td>
                          <td className="px-4 py-3 text-sm">{record.receivedBy?.name || "N/A"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                record.status === "COMPLETED" || record.status === "APPROVED"
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
                                onClick={() => !isJournalFallback && handleView(record)}
                                disabled={isJournalFallback}
                                className="px-3 py-1 text-sm text-blue-600 transition-colors hover:text-blue-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                View
                              </button>
                              {!isJournalFallback && (userRole === "ADMIN" || userRole === "ACCOUNTANT") && (
                                <>
                                  <button
                                    onClick={() => handleEdit(record)}
                                    className="px-3 py-1 text-sm text-green-600 transition-colors hover:text-green-800 hover:underline"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(record)}
                                    className="px-3 py-1 text-sm text-red-600 transition-colors hover:text-red-800 hover:underline"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {showingStart}-{showingEnd} of {filteredRecords.length} filtered records
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select
                    value={String(filters.pageSize)}
                    onValueChange={(value) => {
                      setFilters((current) => ({ ...current, pageSize: Number(value) }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {safeCurrentPage} of {totalPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visualise" className="space-y-0">
          <IncomeCategoryTree categories={categories} breakdown={filteredBreakdown} />
        </TabsContent>
      </Tabs>

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
                categoryId: editData.budgetCategoryId || editData.budgetCategory?.id || "",
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
                externalRef: editData.externalRef ?? editData.referenceNumber ?? "",
                paymentMethod: editData.paymentMethod ?? "CASH",
                depositorName: editData.depositorName ?? "",
                depositorContact: editData.depositorContact ?? "",
                notes: editData.notes ?? "",
              }
            : null
        }
        isEditMode={!!editData}
      />

      {showDeleteDialog && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-red-600">Confirm Delete</h2>
            <p className="mb-2 text-muted-foreground">Are you sure you want to delete this income record?</p>
            <div className="mb-6 rounded-md bg-muted p-4">
              <p className="text-sm">
                <strong>Amount:</strong> {formatCurrency(selectedRecord.amount)}
              </p>
              <p className="text-sm">
                <strong>Category:</strong> {selectedRecord.budgetCategory?.name || "N/A"}
              </p>
              <p className="text-sm">
                <strong>Date:</strong> {formatDate(selectedRecord.recordDate)}
              </p>
              <p className="text-sm">
                <strong>Receipt:</strong> {selectedRecord.receiptNo}
              </p>
            </div>
            <p className="mb-6 text-sm text-red-600">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedRecord(null);
                }}
                disabled={isDeleting}
                className="rounded-md border px-4 py-2 transition-colors hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
