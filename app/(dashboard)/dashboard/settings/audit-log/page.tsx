import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import AuditLogClient from "./components/AuditLogClient";

export const metadata: Metadata = {
  title: "Audit Log",
  description: "System activity and audit trail",
};

export default async function AuditLogPage() {
  const user = await getAuthUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    redirect("/dashboard");
  }

  return <AuditLogClient user={user} initialData={[]} />;
}
