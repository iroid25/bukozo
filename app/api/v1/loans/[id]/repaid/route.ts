import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN can process this
    if (!["LOANOFFICER", "TELLER", "BRANCHMANAGER", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const loanId = params.id;
    
    // Use transaction to ensure data integrity
    const result = await db.$transaction(async (tx) => {
        const loan = await tx.loan.findUnique({
            where: { id: loanId },
        });

        if (!loan) {
            throw new Error("Loan not found");
        }

        if (loan.outstandingBalance > 0.01) { // Small tolerance for rounding
            throw new Error(`Cannot mark loan as repaid while outstanding balance (${loan.outstandingBalance}) exists`);
        }

        const updatedLoan = await tx.loan.update({
            where: { id: loanId },
            data: {
                status: "REPAID",
                outstandingBalance: 0,
            },
        });

        return updatedLoan;
    });

    // Revalidate paths for the dashboard and the specific loan details
    revalidatePath("/dashboard/loans");
    revalidatePath(`/dashboard/loans/${loanId}`);

    return NextResponse.json({
      success: true,
      message: "Loan marked as fully repaid successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Mark loan as repaid error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to mark loan as repaid",
      },
      { status: 500 }
    );
  }
}
