"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import LoanRepaymentDetail from "./components/LoanRepaymentDetailPageClient";

export default function LoanRepaymentDetailPage() {
  const params = useParams() as { id: string };
  const id = params.id;
  
  const [repayment, setRepayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [repaymentRes, sessionRes] = await Promise.all([
          axios.get(`/api/v1/loan-repayments/${id}`),
          axios.get("/api/auth/session"),
        ]);
        
        setRepayment(repaymentRes.data);
        setUser(sessionRes.data?.user);
      } catch (error) {
        console.error("Error fetching repayment data:", error);
        toast.error("Failed to load repayment details");
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!repayment) {
    return (
      <div className="flex h-[450px] items-center justify-center rounded-xl border border-dashed">
        <div className="flex flex-col items-center gap-2 text-center text-red-500">
          <h3 className="text-xl font-bold">Repayment Not Found</h3>
          <p className="text-muted-foreground">
            The loan repayment you are looking for does not exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <LoanRepaymentDetail
        repayment={repayment}
        userRole={user?.role ?? "MEMBER"}
        currentUserId={user?.id ?? ""}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
