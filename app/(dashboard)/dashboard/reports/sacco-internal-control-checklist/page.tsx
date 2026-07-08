"use client";

import { useSession } from "next-auth/react";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import SaccoInternalControlChecklistClient from "./components/SaccoInternalControlChecklistClient";

export default function SaccoInternalControlChecklistPage() {
  const { data: session } = useSession();
  const user = session?.user as
    | {
        role?: string;
        branchId?: string | null;
        branchName?: string | null;
        id?: string | null;
      }
    | undefined;

  return (
    <ReportPageLayout
      title="SACCO Internal Control Checklist"
      description="Editable branch control checklist with PDF and Excel export."
    >
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Sources: branch control checklist updates · approvals · control confirmations · PDF/XLSX export
      </div>
      <SaccoInternalControlChecklistClient
        userRole={user?.role || "MEMBER"}
        userBranchId={user?.branchId ?? null}
        userBranchName={user?.branchName ?? null}
        userId={user?.id ?? null}
      />
    </ReportPageLayout>
  );
}
