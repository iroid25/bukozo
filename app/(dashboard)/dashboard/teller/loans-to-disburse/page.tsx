import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import TellerLoansClient from "./components/TellerLoansClient";

export const metadata: Metadata = {
  title: "Loans to Disburse | Teller Dashboard",
  description: "View and process loans assigned to you for disbursement",
};

export default async function TellerLoansPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!["TELLER", "ADMIN", "Manager", "BRANCHMANAGER"].includes(session.user.role)) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>You do not have permission to view this page. Required role: TELLER</p>
        </div>
      </div>
    );
  }

  return <TellerLoansClient userId={session.user.id} />;
}
