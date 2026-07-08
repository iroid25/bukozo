"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import axios from "axios";
import { toast } from "sonner";
import { TableLoading } from "@/components/ui/data-table";
import LoanRepaymentListing from "./components/LoanRepaymentListing";
import LoanRepaymentCreateForm from "./components/LoanRepaymentCreateForm";

export default function LoanRepaymentsPage() {
  const [repayments, setRepayments] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>({
    totalRepayments: 0,
    totalAmount: 0,
    todayRepayments: 0,
    todayAmount: 0,
    thisMonthRepayments: 0,
    thisMonthAmount: 0,
  });
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; details: string | null } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Session
        try {
          const sessionRes = await axios.get("/api/auth/session");
          setUser(sessionRes.data?.user);
        } catch (sErr) {
          console.warn("[RepaymentsPage] Session fetch failed, but continuing...");
        }

        // 2. Fetch Repayments and Stats in parallel (but caught individually)
        const fetchRepayments = axios.get("/api/v1/loan-repayments?limit=500").catch(err => {
          console.error("[RepaymentsPage] Repayments API 404/Error:", err);
          return { status: err.response?.status || 500, data: { data: [], error: err.message } };
        });

        const fetchStats = axios.get("/api/v1/loan-repayments/statistics").catch(err => {
          console.error("[RepaymentsPage] Statistics API 404/Error:", err);
          return { status: err.response?.status || 500, data: { error: err.message } };
        });

        const [repaymentsRes, statsRes] = await Promise.all([fetchRepayments, fetchStats]);

        if (repaymentsRes.status === 404 || statsRes.status === 404) {
          const failedUrl = repaymentsRes.status === 404 ? "/api/v1/loan-repayments" : "/api/v1/loan-repayments/statistics";
          setError({ 
            message: `API Route Not Found (404)`, 
            details: `The server could not find the path: ${failedUrl}. Please try restarting your dev server (pnpm dev).` 
          });
        }

        setRepayments(repaymentsRes.data?.data || []);
        setStatistics(statsRes.data?.error ? {
          totalRepayments: 0,
          totalAmount: 0,
          todayRepayments: 0,
          todayAmount: 0,
          thisMonthRepayments: 0,
          thisMonthAmount: 0,
        } : (statsRes.data || {}));

      } catch (err: any) {
        console.error("Error fetching repayments data:", err);
        const errorMsg = err.response?.data?.error || err.message || "Failed to load loan repayments";
        const errorDetails = err.response?.data?.details || err.response?.data?.message || null;
        setError({ message: errorMsg, details: errorDetails });
        toast.error(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleAddNew = () => setModalOpen(true);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-1 flex-col gap-4 rounded-xl ">
        <TableLoading />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-1 flex-col gap-4 rounded-xl p-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center mb-6">
          <h3 className="text-xl font-bold text-red-800 mb-2">{error.message}</h3>
          {error.details && (
            <div className="mt-4 text-left">
              <pre className="bg-red-100 p-3 rounded border border-red-200 text-xs overflow-auto max-h-40 font-mono text-red-900">
                {error.details}
              </pre>
            </div>
          )}
          <div className="flex justify-center gap-4 mt-6">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
              Try Again
            </button>
            <button onClick={handleAddNew} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
              Process New Repayment
            </button>
          </div>
        </div>
      )}

      {!error && (
        <LoanRepaymentListing
          title={`Loan Repayments (${repayments.length})`}
          subtitle="Manage Member Loan Repayments"
          loanRepayments={repayments}
          statistics={statistics}
          userRole={user?.role ?? "MEMBER"}
          currentUserId={user?.id ?? ""}
        />
      )}

      <LoanRepaymentCreateForm
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        currentUserId={user?.id ?? ""}
        userRole={user?.role ?? "MEMBER"}
      />
    </div>
  );
}
