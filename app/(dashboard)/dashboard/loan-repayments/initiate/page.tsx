import React from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { serverFetch } from "@/lib/server-fetch";
import InitiateRepaymentClient from "./InitiateRepaymentClient";

export const metadata = {
  title: "Initiate Loan Repayment | SACCO Management",
  description: "Initiate loan repayments from member accounts",
};

const ALLOWED_ROLES = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "TELLER", "AGENT"];

export default async function InitiateRepaymentPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  if (!ALLOWED_ROLES.includes(user.role)) redirect("/dashboard");

  const res = await serverFetch("/api/v1/loans/repayment-queue");
  const json = res.ok ? await res.json() : { data: { activeLoans: [], pendingRequests: [] } };
  const { activeLoans, pendingRequests } = json.data;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Initiate Loan Repayment</h1>
          <p className="text-muted-foreground mt-1">
            Request loan repayments from member accounts with their approval
          </p>
        </div>
      </div>

      <InitiateRepaymentClient
        activeLoans={activeLoans}
        pendingRequests={pendingRequests}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  );
}
