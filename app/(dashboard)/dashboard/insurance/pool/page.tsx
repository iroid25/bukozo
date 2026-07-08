// app/dashboard/insurance/pool/page.tsx
"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/ui/data-table";
import InsurancePoolListing from "./components/InsurancePoolListing";

export default function InsurancePoolPage() {
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<any[]>([]);
  const [statistics, setStatistics] = useState({
    totalPoolBalance: 0,
    totalContributions: 0,
    totalFromLoans: 0,
    monthlyCollection: 0,
  });
  const [userRole, setUserRole] = useState("TELLER");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/insurance/pool", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch insurance pool data");
        }

        setContributions(data.contributions || []);
        setStatistics(
          data.statistics || {
            totalPoolBalance: 0,
            totalContributions: 0,
            totalFromLoans: 0,
            monthlyCollection: 0,
          },
        );
        setUserRole(data.user?.role || "TELLER");
      } catch (error) {
        console.error("Failed to load insurance pool data:", error);
        setContributions([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      {loading ? (
        <TableLoading />
      ) : (
        <InsurancePoolListing
          title="Insurance Pool - Loan Applications"
          subtitle="Insurance contributions collected from loan applications"
          contributions={contributions}
          statistics={statistics}
          userRole={userRole}
        />
      )}
    </div>
  );
}
