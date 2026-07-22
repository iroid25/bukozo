import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanService } from "@/services/loan.service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, branchId, id: userId } = session.user as any;

    let filterBranchId = undefined;
    let officerId = undefined;

    if (["TELLER", "LOANOFFICER", "BRANCHMANAGER", "ACCOUNTANT"].includes(role)) {
        if (branchId) {
          filterBranchId = branchId;
        } else if (["TELLER", "LOANOFFICER"].includes(role)) {
          // No branch on record for this staff member — fall back to
          // "assigned to me" rather than showing everything unscoped.
          officerId = userId;
        }
    }

    const result = await LoanService.getApplicationStatistics({ 
        branchId: filterBranchId, 
        officerId 
    });

    if (!result.ok) throw new Error(result.error);

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error fetching loan application statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
