"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { IncomeListing } from "./components/IncomeListings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function IncomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const [incomeRecords, setIncomeRecords] = useState<IncomeRecordWithRelations[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalIncome: 0,
    todayIncome: 0,
    thisMonthIncome: 0,
    totalRecords: 0,
    todayRecords: 0,
    averageIncome: 0,
    categoryBreakdown: [],
    branchBreakdown: [],
    paymentMethodBreakdown: [],
  });
  const [categories, setCategories] = useState<SimpleBudgetCategory[]>([]);
  const [branches, setBranches] = useState<SimpleBranch[]>([]);
  const [members, setMembers] = useState<SimpleMember[]>([]);
  const [institutions, setInstitutions] = useState<SimpleInstitution[]>([]);
  const [accounts, setAccounts] = useState<SimpleAccount[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      void fetchData();
    }
  }, [status, router, selectedBranchId]);

  useEffect(() => {
    if (status !== "authenticated" || !isAdmin) return;

    const loadBranches = async () => {
      try {
        setBranchLoading(true);
        const response = await fetch("/api/v1/branches", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        setBranches(Array.isArray(payload?.data) ? payload.data : []);
      } finally {
        setBranchLoading(false);
      }
    };

    void loadBranches();
  }, [status, isAdmin]);

  // Helper to safely fetch and parse JSON, returns null on any failure
  const safeFetch = async (url: string): Promise<any> => {
    try {
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn(`API ${url} returned ${res.status}`);
        return null;
      }
      const json = await res.json();
      return json;
    } catch (err) {
      console.warn(`Failed to fetch ${url}:`, err);
      return null;
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const branchParam =
        isAdmin && selectedBranchId !== "all" ? selectedBranchId : undefined;
      const branchQuery = branchParam ? `?branchId=${encodeURIComponent(branchParam)}` : "";

      // Fetch all data in parallel - each call handles its own errors
      const [
        incomeData,
        statsData,
        categoriesData,
        branchesData,
        institutionsData,
        membersData,
        accountsData,
      ] = await Promise.all([
        safeFetch(`/api/v1/income${branchQuery}`),
        safeFetch(`/api/v1/income/statistics${branchQuery}`),
        safeFetch("/api/v1/income/categories"),
        safeFetch("/api/v1/income/branches"),
        safeFetch("/api/v1/institutions"),
        safeFetch("/api/v1/members"),
        safeFetch("/api/v1/accounts"),
      ]);

      // Track which endpoints failed for debugging
      const failedEndpoints: string[] = [];
      if (!incomeData) failedEndpoints.push("income");
      if (!statsData) failedEndpoints.push("statistics");
      if (!categoriesData) failedEndpoints.push("categories");
      if (!branchesData) failedEndpoints.push("branches");

      // Set state - each uses fallback if the endpoint failed
      setIncomeRecords(incomeData?.data || []);
      setStatistics(statsData?.data || statistics);
      setCategories(categoriesData?.data || []);
      const fetchedBranches = Array.isArray(branchesData?.data) ? branchesData.data : [];
      setBranches((current) => {
        const merged = isAdmin ? [...current, ...fetchedBranches] : fetchedBranches;
        return merged.filter(
          (branch: SimpleBranch, index: number, list: SimpleBranch[]) =>
            list.findIndex((item) => item.id === branch.id) === index,
        );
      });
      setInstitutions(institutionsData?.data || []);
      
      // Transform members with high null safety
      const transformedMembers = (membersData?.data || []).map((member: any) => ({
        id: member.id,
        memberNumber: member.memberNumber,
        user: member.user ? {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          phone: member.user.phone,
        } : {
          id: "unknown",
          name: "Unknown User",
          email: null,
          phone: null,
        },
      }));
      setMembers(transformedMembers);

      // Transform accounts with high null safety
      const transformedAccounts = (accountsData?.data || [])
        .filter((account: any) => account && (account.member !== null || account.institution !== null))
        .map((account: any) => ({
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance,
          status: account.status,
          accountType: account.accountType ? {
            id: account.accountType.id,
            name: account.accountType.name,
            minBalance: account.accountType.minBalance,
          } : {
            id: "unknown",
            name: "Unknown Type",
            minBalance: 0,
          },
          member: account.member
            ? {
                id: account.member.id,
                memberNumber: account.member.memberNumber,
                user: {
                  name: account.member.user?.name || "Unknown",
                },
              }
            : null,
          institution: account.institution
            ? {
                id: account.institution.id,
                institutionNumber: account.institution.institutionNumber,
                institutionName: account.institution.institutionName,
              }
            : null,
        }));
      setAccounts(transformedAccounts);

      // Show warning if some endpoints failed but don't block the page
      if (failedEndpoints.length > 0) {
        console.warn(`Some data sources failed to load: ${failedEndpoints.join(", ")}`);
      }

    } catch (err) {
      console.error("Error fetching income data:", err);
      setError("Failed to load income data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading income data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-10 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={fetchData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="px-10">
      {isAdmin && (
        <Card className="mb-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Branch Scope</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-full md:w-[320px]">
                  <SelectValue placeholder={branchLoading ? "Loading branches..." : "All Branches"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => setSelectedBranchId("all")}
              disabled={selectedBranchId === "all"}
            >
              Reset Scope
            </Button>
          </CardContent>
        </Card>
      )}
      <IncomeListing
        title="Income Records"
        subtitle="All recognized income (fees, charges, etc.)"
        incomeRecords={incomeRecords}
        statistics={statistics}
        userRole={session.user.role}
        userId={session.user.id}
        categories={categories}
        branches={branches}
        members={members}
        institutions={institutions}
        accounts={accounts}
        onRefresh={fetchData}
      />
    </div>
  );
}
