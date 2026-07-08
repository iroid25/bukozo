 
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole, TransactionStatus } from "@prisma/client";

/**
 * POST /api/v1/reserve/return/propose
 * Propose returning funds from branch to Organisational Reserve
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== UserRole.ACCOUNTANT && userRole !== UserRole.BRANCHMANAGER) {
      return NextResponse.json(
        { error: "Only accountants and branch managers can propose returns" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { amount, floatAmount, sourceVaultId, targetVaultId, notes } = body;

    // Validate required fields
    if (!amount || !floatAmount || !sourceVaultId || !targetVaultId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const sourceVault = await db.vault.findUnique({
      where: { id: sourceVaultId },
      include: { branch: true },
    });
    const targetVault = await db.vault.findUnique({
      where: { id: targetVaultId },
    });

    if (!sourceVault || !targetVault) {
      return NextResponse.json(
        { error: "Vault(s) not found" },
        { status: 404 }
      );
    }

    const totalAmount = Number(amount) + Number(floatAmount);
    if (sourceVault.balance < totalAmount) {
      return NextResponse.json(
        { error: "Insufficient funds in branch vault" },
        { status: 400 }
      );
    }

    // Create return proposal with PENDING status
    const returnProposal = await db.branchReserveAllocation.create({
      data: {
        amount: Number(amount),
        floatAmount: Number(floatAmount),
        sourceVaultId: sourceVault.id,
        targetVaultId: targetVault.id,
        allocatedByUserId: (session.user as any).id,
        status: TransactionStatus.PENDING,
        // type: AllocationType.RETURN,
        notes: notes || "Branch reserve return proposal",
      },
      include: {
        sourceVault: {
          include: { branch: true },
        },
        targetVault: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: returnProposal,
        message: "Return proposal submitted successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error proposing reserve return:", error);
    return NextResponse.json(
      { error: "Failed to propose return" },
      { status: 500 }
    );
  }
}
