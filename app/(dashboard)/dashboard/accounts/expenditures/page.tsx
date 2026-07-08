"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ExpenditureListing } from "./components/ExpenditureListings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BranchOption {
  id: string;
  name: string;
}

export default function ExpenditurePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  const [expenditureRecords, setExpenditureRecords] = useState([]);
  const [statistics, setStatistics] = useState({
    totalExpenditure: 0,
    todayExpenditure: 0,
    thisMonthExpenditure: 0,
    pendingExpenditure: 0,
    pendingCount: 0,
    totalRecords: 0,
    averageExpenditure: 0,
    categoryBreakdown: [],
    branchBreakdown: [],
  });
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
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
        const fetchedBranches = Array.isArray(payload?.data) ? payload.data : [];
        setBranchOptions(fetchedBranches);
        setBranches(fetchedBranches);
      } finally {
        setBranchLoading(false);
      }
    };

    void loadBranches();
  }, [status, isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const branchParam =
        isAdmin && selectedBranchId !== "all" ? selectedBranchId : undefined;
      const branchQuery = branchParam ? `?branchId=${encodeURIComponent(branchParam)}` : "";

      // Fetch all data in parallel
      const [
        expenditureRes,
        statsRes,
        categoriesRes,
        branchesRes,
      ] = await Promise.all([
        fetch(`/api/v1/expenditure${branchQuery}`, { credentials: "include" }),
        fetch(`/api/v1/expenditure/statistics${branchQuery}`, { credentials: "include" }),
        fetch("/api/v1/expenditure/categories"),
        fetch("/api/v1/expenditure/branches"),
      ]);

      // Parse responses
      const expenditureData = await expenditureRes.json();
      const statsData = await statsRes.json();
      const categoriesData = await categoriesRes.json();
      const branchesData = await branchesRes.json();

      // Set state
      setExpenditureRecords(expenditureData.data || []);
      setStatistics(statsData.data || statistics);
      setCategories(categoriesData.data || []);
      setBranches(branchesData.data || []);

    } catch (err) {
      console.error("Error fetching expenditure data:", err);
      setError("Failed to load expenditure data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading expenditure data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container w-[95%] overflow-x-hidden py-6">
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
    <div className="container w-[95%] overflow-x-hidden py-6">
      {isAdmin && (
        <Card className="mb-6 border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Branch Scope</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-full md:w-[320px]">
                <SelectValue placeholder={branchLoading ? "Loading branches..." : "All Branches"} />
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
      <ExpenditureListing
        title="Expenditure Records"
        subtitle="Manage and track all expenditure transactions"
        expenditureRecords={expenditureRecords}
        statistics={statistics}
        userRole={session.user.role || "MEMBER"}
        userId={session.user.id}
        userBranchId={(session.user as any).branchId}
        categories={categories}
        branches={branches}
      />
    </div>
  );
}
