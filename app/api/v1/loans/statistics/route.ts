import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get branchId and officerId from user if they are staff
    let branchId = undefined;
    let officerId = undefined;
    
    if (["TELLER", "LOANOFFICER", "BRANCHMANAGER"].includes((session.user as any).role)) {
        if ((session.user as any).branchId) {
            branchId = (session.user as any).branchId;
        }
        // Only TELLER uses allocatedTellerId; LOANOFFICER scopes by branch only
        if ((session.user as any).role === "TELLER") {
            officerId = (session.user as any).id;
        }
    }

    const result = await import("@/services/loan.service").then(m => m.LoanService.getStatistics({ branchId, officerId }));
    
    if (!result.ok) {
        throw new Error(result.error);
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error fetching loan statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan statistics" },
      { status: 500 }
    );
  }
}
