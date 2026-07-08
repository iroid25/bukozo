"use client";

import { useSession } from "next-auth/react";

import { ReportPageLayout } from "@/components/reports/ReportPageLayout";
import CustomerInformationAuditTrailClient from "./components/CustomerInformationAuditTrailClient";

export default function CustomerInformationAuditTrailPage() {
  const { data: session } = useSession();
  const user = session?.user as
    | {
        role?: string;
        branchId?: string | null;
        branchName?: string | null;
      }
    | undefined;

  return (
    <ReportPageLayout
      title="Audit Trail Report Customer Information"
      description="Controlled audit trail with customer context, before/after snapshots, and branch/operator visibility."
    >
      <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Sources: member profile edits · before/after snapshots · branch context · operator identity · approval changes · fingerprint enrollment
      </div>
      <CustomerInformationAuditTrailClient
        userRole={user?.role || "MEMBER"}
        title="Customer Information Audit Trail"
        subtitle="Controlled audit trail with customer context and branch visibility."
        currentUserBranchId={user?.branchId ?? null}
        currentUserBranchName={user?.branchName ?? null}
      />
    </ReportPageLayout>
  );
}
