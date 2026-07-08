import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import DisbursementQueueClient from "./DisbursementQueueClient";

export const metadata: Metadata = {
  title: "Disbursement Queue | Loan Process",
  description: "Track and disburse loans assigned to you",
};

export default async function DisbursementQueuePage() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      redirect("/auth/login");
      return;
    }

    const userRole = session.user.role;
    const branchId = (session.user as any).branchId as string | undefined;

    if (!["TELLER", "ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(userRole)) {
      return (
        <div className="container mx-auto py-10">
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p>You do not have permission to view this page. Required roles: LOAN OFFICER, TELLER, or MANAGER</p>
          </div>
        </div>
      );
    }

    return (
      <DisbursementQueueClient
        userRole={userRole}
        branchId={branchId}
      />
    );
  } catch (error) {
    if ((error as any)?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("DisbursementQueuePage error:", error);
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Unable to load disbursement queue</p>
            <p className="text-sm">
              {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
            </p>
          </div>
        </div>
      </div>
    );
  }
}
