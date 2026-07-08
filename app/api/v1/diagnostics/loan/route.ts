import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get("loanId");

    const loan = await db.loan.findUnique({
      where: { id: loanId || "" },
      include: {
        loanApplication: { include: { loanProduct: true } },
        schedules: true,
        ledgerTransactions: true
      }
    });

    if (!loan) return NextResponse.json({ error: "Loan not found" });

    return NextResponse.json({
        loanId: loan.id,
        scheduleCount: loan.schedules.length,
        ledgerCount: loan.ledgerTransactions.length,
        ledger: loan.ledgerTransactions.map(t => ({
            type: t.transactionType,
            debitP: t.debitPrincipal,
            creditP: t.creditPrincipal,
            balT: t.balanceTotal
        }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
