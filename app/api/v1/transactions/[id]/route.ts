// app/api/v1/transactions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType } from "@prisma/client";
import { authOptions } from "@/config/auth";

const transactionInclude = {
  member: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  },
  institution: {
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  account: {
    include: {
      accountType: true,
      branch: true,
    },
  },
  processedByUser: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  deposit: {
    include: {
      handler: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  },
  withdrawal: {
    include: {
      handler: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  },
};

// GET single transaction by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const transaction = await db.transaction.findUnique({
      where: { id },
      include: transactionInclude,
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transaction",
      },
      { status: 500 }
    );
  }
}

// PATCH - Update transaction
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        description: body.description,
        status: body.status,
        externalReference: body.externalReference,
        notes: body.notes,
      },
      include: transactionInclude,
    });

    return NextResponse.json({
      success: true,
      data: transaction,
      message: "Transaction updated successfully",
    });
  } catch (error) {
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update transaction",
      },
      { status: 500 }
    );
  }
}

// DELETE - Reverse transaction (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") || "Transaction reversed";

    // Get the original transaction
    const originalTransaction = await db.transaction.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if transaction can be reversed
    if (originalTransaction.status !== TransactionStatus.COMPLETED) {
      return NextResponse.json(
        {
          success: false,
          error: "Only completed transactions can be reversed",
        },
        { status: 400 }
      );
    }

    // Check if within 24 hours
    const hoursSinceTransaction =
      (Date.now() - new Date(originalTransaction.transactionDate).getTime()) /
      (1000 * 60 * 60);

    if (hoursSinceTransaction > 24) {
      return NextResponse.json(
        {
          success: false,
          error: "Transactions can only be reversed within 24 hours",
        },
        { status: 400 }
      );
    }

    // Create reversal transaction
    const result = await db.$transaction(async (tx) => {
      const reversalRef = `REV-${originalTransaction.transactionRef}`;

      const reversalTransaction = await tx.transaction.create({
        data: {
          transactionRef: reversalRef,
          memberId: originalTransaction.memberId,
          institutionId: originalTransaction.institutionId,
          accountId: originalTransaction.accountId,
          type: originalTransaction.type,
          amount: -originalTransaction.amount,
          status: TransactionStatus.COMPLETED,
          description: `Reversal of ${originalTransaction.transactionRef}: ${reason}`,
          transactionDate: new Date(),
          processedByUserId: session.user.id,
          relatedTransactionId: originalTransaction.id,
          channel: originalTransaction.channel,
        },
      });

      // Mark original transaction as reversed
      await tx.transaction.update({
        where: { id },
        data: {
          status: TransactionStatus.REVERSED,
          relatedTransactionId: reversalTransaction.id,
        },
      });

      // Update account balance
      const account = originalTransaction.account;
      if (account) {
        let newBalance = account.balance;
        if (originalTransaction.type === TransactionType.DEPOSIT) {
          newBalance -= originalTransaction.amount;
        } else if (originalTransaction.type === TransactionType.WITHDRAWAL) {
          newBalance += originalTransaction.amount;
        }

        await tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        });
      }

      return reversalTransaction;
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Transaction reversed successfully",
    });
  } catch (error) {
    console.error("Error reversing transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to reverse transaction",
      },
      { status: 500 }
    );
  }
}
