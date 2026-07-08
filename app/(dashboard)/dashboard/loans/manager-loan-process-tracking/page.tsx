import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { serverFetch } from "@/lib/server-fetch";
import ManagerLoanApplicationsManager from "./components/LoanapplicationProcess";

export const dynamic = "force-dynamic";

export default async function ManagerLoanProcessTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string }>;
}) {
  const currentUser = await getAuthUser();
  if (!currentUser) redirect("/login");
  if (!["ADMIN", "BRANCHMANAGER"].includes(currentUser.role)) redirect("/dashboard");

  const params = await searchParams;

  const res = await serverFetch("/api/v1/loans/applications/manager-combined");
  if (!res.ok) redirect("/dashboard");
  const json = await res.json();
  const { applications, statistics, loanOfficers } = json.data;

  return (
    <div className="p-5">
      <ManagerLoanApplicationsManager
        initialApplications={applications}
        initialStatistics={statistics}
        loanOfficers={loanOfficers}
        userRole={currentUser.role}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        highlightId={params.highlight}
      />
    </div>
  );
}
