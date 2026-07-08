"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { IncomeListing } from "../components/IncomeListings";
import { AccountStatus } from "@prisma/client";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        incomeRes,
        statsRes,
        categoriesRes,
        branchesRes,
        institutionsRes,
        membersRes,
        accountsRes,
      ] = await Promise.all([
        fetch("/api/v1/income"),
        fetch("/api/v1/income/statistics"),
        fetch("/api/v1/income/categories"),
        fetch("/api/v1/income/branches"),
        fetch("/api/v1/institutions"),
        fetch("/api/v1/members"),
        fetch("/api/v1/accounts"),
      ]);

      // Parse responses
      const incomeData = await incomeRes.json();
      const statsData = await statsRes.json();
      const categoriesData = await categoriesRes.json();
      const branchesData = await branchesRes.json();
      const institutionsData = await institutionsRes.json();
      const membersData = await membersRes.json();
      const accountsData = await accountsRes.json();

      // Set state
      setIncomeRecords(incomeData.data || []);
      setStatistics(statsData.data || statistics);
      setCategories(categoriesData.data || []);
      setBranches(branchesData.data || []);
      setInstitutions(institutionsData.data || []);
      
      // Transform members
      const transformedMembers = (membersData.data || []).map((member: any) => ({
        id: member.id,
        memberNumber: member.memberNumber,
        user: {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          phone: member.user.phone,
        },
      }));
      setMembers(transformedMembers);

      // Transform accounts
      const transformedAccounts = (accountsData.data || [])
        .filter((account: any) => account.member !== null || account.institution !== null)
        .map((account: any) => ({
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance,
          status: account.status as AccountStatus,
          accountType: {
            id: account.accountType.id,
            name: account.accountType.name,
            minBalance: account.accountType.minBalance,
          },
          member: account.member
            ? {
                id: account.member.id,
                memberNumber: account.member.memberNumber,
                user: {
                  name: account.member.user.name,
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
      />
    </div>
  );
}
