import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/config/auth";
import LoanReschedulesClient from "./LoanReschedulesClient";
import { serverFetch } from "@/lib/server-fetch";

export const metadata: Metadata = {
  title: "Loan Rescheduling | SACCO Management",
  description: "Manage loan reschedule requests",
};

export default async function LoanReschedulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const allowedRoles = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "AUDITOR"];
  if (!allowedRoles.includes(session.user.role)) redirect("/dashboard");

  const res = await serverFetch("/api/v1/loans/reschedules");
  const json = res.ok ? await res.json() : { data: [] };
  const reschedules = json.data ?? [];

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <LoanReschedulesClient
        data={reschedules}
        userRole={session.user.role}
        currentUserId={session.user.id}
      />
    </div>
  );
}
