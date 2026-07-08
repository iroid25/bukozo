import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: loanId } = await params;
    const loan = await db.loan.findUnique({ where: { id: loanId } });

    if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    if (loan.outstandingBalance > 0) {
      return NextResponse.json({ error: "Cannot mark loan as repaid while outstanding balance exists" }, { status: 400 });
    }

    const updatedLoan = await db.loan.update({
      where: { id: loanId },
      data: { status: "REPAID", outstandingBalance: 0 },
    });

    return NextResponse.json({ data: updatedLoan, message: "Loan marked as repaid" });
  } catch (error: any) {
    console.error("Error marking loan as repaid:", error);
    return NextResponse.json({ error: "Failed to update loan status." }, { status: 500 });
  }
}
