import React from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import LoanApplicationsClient from "./components/LoanApplicationsClient";

export const metadata = {
  title: "Loan Applications | SACCO Management",
  description: "Manage member loan applications",
};

const emptyStats = { pending: 0, approved: 0, rejected: 0, disbursed: 0, underReview: 0, totalAmount: 0 };

export default async function LoanApplicationsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <LoanApplicationsClient
        initialApplications={[]}
        loanProducts={[]}
        statistics={emptyStats}
        currentUserId={user.id}
        currentUserRole={user.role}
      />
    </div>
  );
}
