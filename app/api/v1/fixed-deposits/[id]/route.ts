import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";

// GET /api/v1/fixed-deposits/[id] - Get single fixed deposit
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const fixedDeposit = await db.fixedDeposit.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        branch: {
          select: {
            name: true,
            location: true,
          },
        },
      },
    });

    if (!fixedDeposit) {
      return NextResponse.json(
        { error: "Fixed deposit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: fixedDeposit });
  } catch (error) {
    console.error("Error fetching fixed deposit:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixed deposit" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/fixed-deposits/[id] - Update fixed deposit
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "BRANCHMANAGER"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id } = await params;

    // Check if fixed deposit exists
    const existingDeposit = await db.fixedDeposit.findUnique({
      where: { id },
    });

    if (!existingDeposit) {
      return NextResponse.json(
        { error: "Fixed deposit not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.interestRate !== undefined) {
      updateData.interestRate = body.interestRate;
      // Recalculate maturity amount if interest rate changes
      const interest = existingDeposit.principalAmount * (body.interestRate / 100) * (existingDeposit.termMonths / 12);
      updateData.maturityAmount = existingDeposit.principalAmount + interest;
    }

    if (body.autoRenew !== undefined) {
      updateData.autoRenew = body.autoRenew;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    // Update fixed deposit
    const updatedDeposit = await db.fixedDeposit.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          select: {
            memberNumber: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: updatedDeposit,
      message: "Fixed deposit updated successfully",
    });
  } catch (error) {
    console.error("Error updating fixed deposit:", error);
    return NextResponse.json(
      { error: "Failed to update fixed deposit" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/fixed-deposits/[id] - Reverse/Delete fixed deposit
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can reverse fixed deposits" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const reversalReason = body.reversalReason || "Administrative reversal";
    const { id } = await params;

    // Check if fixed deposit exists
    const existingDeposit = await db.fixedDeposit.findUnique({
      where: { id },
      include: { member: { include: { user: { select: { name: true } } } }, institution: { select: { institutionName: true } } },
    });

    if (!existingDeposit) {
      return NextResponse.json(
        { error: "Fixed deposit not found" },
        { status: 404 }
      );
    }

    if (existingDeposit.isReversed) {
      return NextResponse.json(
        { error: "Fixed deposit already reversed" },
        { status: 400 }
      );
    }

    // Mark as reversed and restore funds to funding source
    const reversedDeposit = await db.$transaction(async (tx) => {
      const updated = await tx.fixedDeposit.update({
        where: { id },
        data: {
          isReversed: true,
          reversedDate: new Date(),
          reversalReason,
          status: "REVERSED",
        },
      });

      // Restore funds to the funding source account if one exists
      if (existingDeposit.fundingSourceAccountId && existingDeposit.principalAmount > 0) {
        await tx.account.update({
          where: { id: existingDeposit.fundingSourceAccountId },
          data: { balance: { increment: existingDeposit.principalAmount } },
        });

        // Create reversal transaction record
        await tx.transaction.create({
          data: {
            transactionRef: `FD-REV-${Date.now()}`,
            type: "TRANSFER",
            amount: existingDeposit.principalAmount,
            status: "COMPLETED",
            description: `Fixed deposit reversal - ${reversalReason}`,
            accountId: existingDeposit.fundingSourceAccountId,
            transactionDate: new Date(),
            processedByUserId: session.user.id,
          },
        });

        // GL reversal entry: Dr FD Liability (201003) / Cr Source Account
        const fdLiabilityAccount = await tx.chartOfAccount.findFirst({
          where: { accountCode: "201003", isActive: true },
        });
        if (fdLiabilityAccount) {
          const reversalEntryNum = `JE-FD-REV-${Date.now()}`;
          await tx.journalEntry.createMany({
            data: [
              {
                entryNumber: reversalEntryNum,
                accountId: fdLiabilityAccount.id,
                debitAmount: existingDeposit.principalAmount,
                creditAmount: 0,
                description: `FD Reversal - ${existingDeposit.member?.user?.name || existingDeposit.institution?.institutionName || "Unknown"}`,
                entryDate: new Date(),
                reference: `FD-REV-${Date.now()}`,
                branchId: existingDeposit.branchId || undefined,
                createdByUserId: session.user.id as string,
              },
              {
                entryNumber: reversalEntryNum,
                accountId: existingDeposit.fundingSourceAccountId,
                debitAmount: 0,
                creditAmount: existingDeposit.principalAmount,
                description: `FD Reversal - funds returned to source`,
                entryDate: new Date(),
                reference: `FD-REV-${Date.now()}`,
                branchId: existingDeposit.branchId || undefined,
                createdByUserId: session.user.id as string,
              },
            ],
          });
          await tx.chartOfAccount.update({
            where: { id: fdLiabilityAccount.id },
            data: { debitBalance: { increment: existingDeposit.principalAmount }, balance: { decrement: existingDeposit.principalAmount } },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({
      data: reversedDeposit,
      message: "Fixed deposit reversed successfully",
    });
  } catch (error) {
    console.error("Error reversing fixed deposit:", error);
    return NextResponse.json(
      { error: "Failed to reverse fixed deposit" },
      { status: 500 }
    );
  }
}
