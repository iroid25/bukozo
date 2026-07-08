import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Derive bank accounts from imported bank statements
    const imports = await db.bankStatementImport.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        lines: {
          select: { amount: true, direction: true },
        },
      },
      orderBy: { importedAt: "desc" },
    });

    // Group by accountNumber so each unique bank account appears once
    const accountMap = new Map<
      string,
      { id: string; bankName: string; accountNumber: string; balance: number }
    >();

    for (const imp of imports) {
      const key = imp.accountNumber ?? imp.id;
      if (accountMap.has(key)) continue;

      const credits = imp.lines
        .filter((l) => l.direction === "CREDIT")
        .reduce((s, l) => s + l.amount, 0);
      const debits = imp.lines
        .filter((l) => l.direction === "DEBIT")
        .reduce((s, l) => s + l.amount, 0);

      accountMap.set(key, {
        id: imp.id,
        bankName: imp.bankName,
        accountNumber: imp.accountNumber ?? "N/A",
        balance: credits - debits,
      });
    }

    return NextResponse.json({ bankAccounts: Array.from(accountMap.values()) });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank accounts" },
      { status: 500 }
    );
  }
}
