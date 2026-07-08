"use client";

import { useState, useEffect, use } from "react";
import { notFound } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import { toast } from "sonner";
import LoanDetailView from "../components/loan-detail/LoanDetailView";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default function LoanDetailPage({ params }: Props) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLoanData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/v1/loans/${id}`);
      if (res.data.success) {
        setLoan(res.data.data);
      } else {
        throw new Error(res.data.error || "Failed to fetch loan");
      }
    } catch (err: any) {
      const message =
        err.response?.data?.error || err.message || "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchLoanData();
    }
  }, [id, status]);

  if (loading || status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-red-50 text-red-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
            Failed to load loan
          </h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">
            {error || "Loan not found"}
          </p>
        </div>
        <Button
          onClick={fetchLoanData}
          className="bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl px-8"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4 bg-gray-50/50">
      <LoanDetailView
        loan={loan}
        userRole={session?.user?.role ?? "TELLER"}
        currentUserId={session?.user?.id ?? ""}
      />
    </div>
  );
}
