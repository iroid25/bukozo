import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import InstitutionLoanApplicationsTracking from "../insitituion-loan-process-tracking/InstitutionLoanApplicationsTracking";
import { serverFetch } from "@/lib/server-fetch";

export default async function MyLoanApplicationsPage() {
  const currentUser = await getAuthUser();

  if (!currentUser) redirect("/login");
  if (currentUser.role !== "INSTITUTION") redirect("/dashboard");

  const res = await serverFetch("/api/v1/institutions/me");
  if (!res.ok) redirect("/dashboard");

  const json = await res.json();
  const institution = json.data;

  if (!institution) redirect("/dashboard");

  return (
    <InstitutionLoanApplicationsTracking
      institutionId={institution.id}
      institutionName={institution.institutionName}
    />
  );
}
