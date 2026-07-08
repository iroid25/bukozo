// hooks/useActiveLoans.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ActiveLoanResponse,
  ActiveLoansApiResponse,
  isSuccessfulActiveLoansResponse,
  UseActiveLoansResult,
} from "@/types/active-loans";

/**
 * Custom hook to fetch and manage active loans
 * Works for both AGENT (all loans) and MEMBER (their loans only)
 */
export function useActiveLoans(): UseActiveLoansResult {
  const [loans, setLoans] = useState<ActiveLoanResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveLoans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔵 Fetching active loans from /api/v1/loans/active");

      const response = await fetch("/api/v1/loans/active", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store", // Always fetch fresh data
      });

      const data: ActiveLoansApiResponse = await response.json();

      console.log("📊 API Response:", {
        status: response.status,
        success: data.success,
        count: data.count,
        userRole: data.userRole,
      });

      if (!response.ok) {
        throw new Error(
          data.error || `HTTP ${response.status}: Failed to fetch active loans`
        );
      }

      if (!isSuccessfulActiveLoansResponse(data)) {
        throw new Error("Invalid response format from server");
      }

      console.log(`✅ Successfully loaded ${data.loans.length} active loans`);
      setLoans(data.loans);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch active loans";
      console.error("❌ Error fetching active loans:", errorMessage);
      setError(errorMessage);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchActiveLoans();
  }, [fetchActiveLoans]);

  return {
    loans,
    loading,
    error,
    refetch: fetchActiveLoans,
  };
}

/**
 * Hook with additional filtering capabilities
 */
export function useFilteredActiveLoans(initialFilter?: {
  isOverdue?: boolean;
  minAmount?: number;
  maxAmount?: number;
}) {
  const { loans, loading, error, refetch } = useActiveLoans();
  const [filteredLoans, setFilteredLoans] = useState<ActiveLoanResponse[]>([]);

  useEffect(() => {
    if (!initialFilter) {
      setFilteredLoans(loans);
      return;
    }

    const filtered = loans.filter((loan) => {
      if (
        initialFilter.isOverdue !== undefined &&
        loan.isOverdue !== initialFilter.isOverdue
      ) {
        return false;
      }
      if (
        initialFilter.minAmount &&
        loan.outstandingBalance < initialFilter.minAmount
      ) {
        return false;
      }
      if (
        initialFilter.maxAmount &&
        loan.outstandingBalance > initialFilter.maxAmount
      ) {
        return false;
      }
      return true;
    });

    setFilteredLoans(filtered);
  }, [loans, initialFilter]);

  return {
    loans: filteredLoans,
    allLoans: loans,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch a single active loan by ID
 */
export function useActiveLoan(loanId: string | null) {
  const { loans, loading, error, refetch } = useActiveLoans();
  const [loan, setLoan] = useState<ActiveLoanResponse | null>(null);

  useEffect(() => {
    if (!loanId) {
      setLoan(null);
      return;
    }

    const foundLoan = loans.find((l) => l.id === loanId);
    setLoan(foundLoan || null);
  }, [loanId, loans]);

  return {
    loan,
    loading,
    error,
    refetch,
  };
}
