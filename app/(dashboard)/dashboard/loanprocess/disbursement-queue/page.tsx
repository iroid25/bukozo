import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { redirect } from "next/navigation";
import { AlertCircle, Wallet } from "lucide-react";
import TellerTrackingTable from "./components/TellerTrackingTable";
import { serverFetch } from "@/lib/server-fetch";

export const metadata: Metadata = {
  title: "Disbursement Queue | Loan Process",
  description: "Track and disburse loans assigned to you",
};

export default async function DisbursementQueuePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  const userRole = session.user.role;
  const branchId = (session.user as any).branchId as string | undefined;

  if (!["TELLER", "ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(userRole)) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>You do not have permission to view this page. Required roles: LOAN OFFICER, TELLER, or MANAGER</p>
        </div>
      </div>
    );
  }

  // ADMIN with no branch sees all approved loans; branch staff filter by branch; tellers by assignment
  let loansQuery: string;
  if (userRole === "ADMIN" && !branchId) {
    loansQuery = `/api/v1/loans?status=APPROVED`;
  } else if (["ADMIN", "BRANCHMANAGER"].includes(userRole) && branchId) {
    loansQuery = `/api/v1/loans?branchId=${branchId}&status=APPROVED`;
  } else {
    loansQuery = `/api/v1/loans?allocatedTellerId=${session.user.id}&status=APPROVED`;
  }

  // LOANOFFICER uses personal float; ADMIN/BRANCHMANAGER with branch use vault balance
  const usesVaultBalance = ["ADMIN", "BRANCHMANAGER"].includes(userRole) && !!branchId;
  const balanceEndpoint = usesVaultBalance ? "/api/v1/vault/balance" : "/api/v1/floats/me";

  const [loansRes, balanceRes] = await Promise.all([
    serverFetch(loansQuery),
    serverFetch(balanceEndpoint),
  ]);

  const loansJson = loansRes.ok ? await loansRes.json() : { success: false, data: [] };
  const loans = loansJson.success ? (loansJson.data ?? []) : [];

  let balanceAmount = 0;
  let balanceLabel = "Your Float Balance";

  if (usesVaultBalance) {
    const balJson = balanceRes.ok ? await balanceRes.json() : {};
    balanceAmount = balJson.balance ?? 0;
    balanceLabel = "Branch Reserve Balance";
  } else {
    const balJson = balanceRes.ok ? await balanceRes.json() : { success: false, data: null };
    balanceAmount = balJson.success ? (balJson.data?.userFloat?.balance ?? 0) : 0;
    balanceLabel = userRole === "LOANOFFICER" ? "Your Float Balance" : "Your Personal Float";
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disbursement Queue</h1>
          <p className="text-muted-foreground">
            {usesVaultBalance
              ? "Manage and disburse loans from the branch reserve."
              : "Track and disburse loans assigned to your personal float."}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
          <Wallet className="h-5 w-5 text-blue-600" />
          <div className="flex flex-col">
            <span className="text-xs text-blue-600 font-medium">{balanceLabel}</span>
            <span className="text-lg font-bold text-blue-800">
              UGX {balanceAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <TellerTrackingTable loans={loans} currentFloat={balanceAmount} />
      </div>
    </div>
  );
}
