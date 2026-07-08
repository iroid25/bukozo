import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { UserRole, TransactionStatus } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

function hasBankAccess(role?: string | null) {
  return ["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"].includes(role || "");
}

async function autoMatchStatementLine(input: {
  reference?: string | null;
  description?: string | null;
  amount: number;
  lineDate: Date;
  accountNumber?: string | null;
}) {
  const where: any = {
    amount: Math.abs(input.amount),
    status: TransactionStatus.COMPLETED,
  };

  const candidates = await db.transaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
    take: 25,
    include: { account: { select: { id: true, accountNumber: true } } },
  });

  const normalizedRef = (input.reference || "").toLowerCase();
  const normalizedDesc = (input.description || "").toLowerCase();

  const scored = candidates.map((candidate) => {
    const haystack = [
      candidate.transactionRef,
      candidate.description || "",
      candidate.paymentReference || "",
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    if (normalizedRef && haystack.includes(normalizedRef)) score += 5;
    if (normalizedDesc && haystack.includes(normalizedDesc.slice(0, 20))) score += 2;
    if (candidate.transactionDate && Math.abs(candidate.transactionDate.getTime() - input.lineDate.getTime()) < 1000 * 60 * 60 * 24 * 7) {
      score += 1;
    }

    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < 3) return null;
  return best.candidate;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !hasBankAccess(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const imports = await db.bankStatementImport.findMany({
      include: {
        importedBy: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            matchedTransaction: {
              select: { id: true, transactionRef: true, amount: true, type: true, status: true },
            },
          },
          orderBy: { lineNo: "asc" },
        },
      },
      orderBy: { importedAt: "desc" },
      take: 25,
    });

    return NextResponse.json({ success: true, data: imports });
  } catch (error) {
    console.error("Error fetching bank statement imports:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch bank statements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || !hasBankAccess(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const bankName = String(body.bankName || "").trim();
    if (!bankName) {
      return NextResponse.json({ success: false, error: "bankName is required" }, { status: 400 });
    }

    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) {
      return NextResponse.json({ success: false, error: "At least one statement line is required" }, { status: 400 });
    }

    const created = await db.$transaction(async (tx) => {
      const imported = await tx.bankStatementImport.create({
        data: {
          bankName,
          accountNumber: body.accountNumber ? String(body.accountNumber) : null,
          statementDate: body.statementDate ? new Date(body.statementDate) : null,
          periodStart: body.periodStart ? new Date(body.periodStart) : null,
          periodEnd: body.periodEnd ? new Date(body.periodEnd) : null,
          sourceFileName: body.sourceFileName ? String(body.sourceFileName) : null,
          sourceFileUrl: body.sourceFileUrl ? String(body.sourceFileUrl) : null,
          notes: body.notes ? String(body.notes) : null,
          importedByUserId: user.id,
        },
      });

      const createdLines = [];
      for (let i = 0; i < lines.length; i += 1) {
        const rawLine = lines[i] || {};
        const amount = Number(rawLine.amount || 0);
        const lineDate = rawLine.transactionDate ? new Date(rawLine.transactionDate) : new Date();

        const matchedTransaction = await autoMatchStatementLine({
          reference: rawLine.reference ? String(rawLine.reference) : null,
          description: rawLine.description ? String(rawLine.description) : null,
          amount,
          lineDate,
          accountNumber: body.accountNumber ? String(body.accountNumber) : null,
        });

        const line = await tx.bankStatementLine.create({
          data: {
            importId: imported.id,
            lineNo: typeof rawLine.lineNo === "number" ? rawLine.lineNo : i + 1,
            transactionDate: lineDate,
            valueDate: rawLine.valueDate ? new Date(rawLine.valueDate) : null,
            description: String(rawLine.description || ""),
            reference: rawLine.reference ? String(rawLine.reference) : null,
            amount,
            direction: String(rawLine.direction || (amount >= 0 ? "CREDIT" : "DEBIT")),
            matchedTransactionId: matchedTransaction?.id || null,
            matchStatus: matchedTransaction ? "MATCHED" : "UNMATCHED",
            matchConfidence: matchedTransaction ? 0.9 : 0,
            notes: rawLine.notes ? String(rawLine.notes) : null,
            matchedAt: matchedTransaction ? new Date() : null,
          },
        });
        createdLines.push(line);
      }

      return { imported, createdLines };
    });

    void bumpAccountingSyncState("Bank statement imported");

    return NextResponse.json({
      success: true,
      data: created,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error importing bank statement:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to import bank statement" },
      { status: 500 },
    );
  }
}
