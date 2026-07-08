// FILE: app/dashboard/insurance/page.tsx
"use client";

import { useEffect, useState } from "react";
import { TableLoading } from "@/components/ui/data-table";
import InsuranceListing from "./components/InsuranceListing";
import { InsuranceRecord, InsuranceStatistics } from "@/types/insurance";

const emptyStatistics: InsuranceStatistics = {
  totalPoolBalance: 0,
  totalCollected: 0,
  totalPaidOut: 0,
  monthlyCollection: 0,
  membersCovered: 0,
  averageContribution: 0,
};

export default function InsurancePage() {
  const [loading, setLoading] = useState(true);
  const [insuranceRecords, setInsuranceRecords] = useState<InsuranceRecord[]>([]);
  const [statistics, setStatistics] =
    useState<InsuranceStatistics>(emptyStatistics);
  const [userRole, setUserRole] = useState("TELLER");
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/v1/insurance", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch insurance data");
        }

        setInsuranceRecords(data.records || []);
        setStatistics(data.statistics || emptyStatistics);
        setUserRole(data.user?.role || "TELLER");
        setCurrentUserId(data.user?.id || "");
      } catch (error) {
        console.error("Failed to load insurance page data:", error);
        setInsuranceRecords([]);
        setStatistics(emptyStatistics);
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
        <InsuranceListing
          title={`Insurance Records (${insuranceRecords.length})`}
          subtitle="Monitor SACCO Insurance Pool & Member Contributions"
          insuranceRecords={insuranceRecords}
          statistics={statistics}
          userRole={userRole}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
