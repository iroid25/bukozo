import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { UserRole, VaultTransactionType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== UserRole.ACCOUNTANT && user.role !== UserRole.ADMIN && user.role !== UserRole.BRANCHMANAGER)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vaultId = searchParams.get("vaultId");
    if (!vaultId) {
      return NextResponse.json({ error: "Vault ID required" }, { status: 400 });
    }

    const vault = await db.vault.findFirst({
      where: { id: vaultId, custodianUserId: user.id, isActive: true },
    });
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const whereClause: any = { vaultId };
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type") as VaultTransactionType | null;
    const limit = searchParams.get("limit");

    if (startDate || endDate) {
      whereClause.transactionDate = {};
      if (startDate) whereClause.transactionDate.gte = new Date(startDate);
      if (endDate) whereClause.transactionDate.lte = new Date(endDate);
    }
    if (type) whereClause.type = type;

    const transactions = await db.vaultTransaction.findMany({
      where: whereClause,
      include: {
        performedBy: { select: { id: true, name: true, role: true } },
        relatedUser: { select: { id: true, name: true, role: true } },
      },
      orderBy: { transactionDate: "desc" },
      take: limit ? parseInt(limit) : 100,
    });

    return NextResponse.json({ success: true, data: transactions, count: transactions.length });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
