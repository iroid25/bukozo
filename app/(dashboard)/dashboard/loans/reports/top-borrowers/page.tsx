"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { TableLoading } from "@/components/ui/data-table";
import TopBorrowersListing from "./components/TopBorrowersListing";
import { toast } from "sonner";

export default function TopBorrowersPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/reports/loans/top-bottom-borrowers?limit=20", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to fetch top borrowers");
        const result = await response.json();
        setData(result.data);
      } catch (error) {
        console.error("Error fetching top borrowers:", error);
        toast.error("Failed to load top borrowers report");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchData();
    }
  }, [session]);

  if (loading || !data) {
    return <TableLoading />;
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <TopBorrowersListing
        title={`Top & Bottom Borrowers (${data.summary.totalBorrowers})`}
        subtitle="Analyze top and bottom performing borrowers"
        data={data}
        branchId={session?.user?.branchId ?? ""}
        role={session?.user?.role ?? "TELLER"}
      />
    </div>
  );
}
