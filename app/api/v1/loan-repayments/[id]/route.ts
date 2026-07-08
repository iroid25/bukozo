import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";

/**
 * GET /api/v1/loan-repayments/[id]
 * Fetch a single loan repayment with details
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;

    const repayment = await db.loanRepayment.findUnique({
      where: { id },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    image: true,
                  },
                },
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
            branch: true,
          },
        },
        handler: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!repayment) {
      return NextResponse.json({ error: "Repayment not found" }, { status: 404 });
    }

    return NextResponse.json(repayment);
  } catch (error) {
    console.error("Error fetching loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan repayment" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/loan-repayments/[id]
 * Update a loan repayment (amount, channel, etc.)
 * Only allowed within 24 hours by handler or admin
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await props.params;
    const data = await request.json();

    // Get the existing repayment
    const existingRepayment = await db.loanRepayment.findUnique({
      where: { id },
      include: {
        loan: true,
      },
    });

    if (!existingRepayment) {
      return NextResponse.json({ error: "Repayment not found" }, { status: 404 });
    }

    // Check if user can modify (within 24 hours and is handler or admin)
    const hoursSincePayment =
      (Date.now() - existingRepayment.repaymentDate.getTime()) /
      (1000 * 60 * 60);

    const canModify =
      hoursSincePayment <= 24 &&
      (existingRepayment.handlerUserId === user.id || user.role === "ADMIN");

    if (!canModify) {
      return NextResponse.json(
        { error: "Cannot modify repayment after 24 hours or unauthorized" },
        { status: 403 }
      );
    }

    // Validate new amount
    if (data.amount <= 0) {
      return NextResponse.json(
        { error: "Repayment amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Calculate the difference in amount
    const amountDifference = data.amount - existingRepayment.amount;
    const currentBalance = existingRepayment.loan.outstandingBalance;
    const newBalance = currentBalance + amountDifference;

    // Ensure new balance doesn't go negative
    if (newBalance < 0) {
      return NextResponse.json(
        { error: "Repayment amount would exceed total loan amount" },
        { status: 400 }
      );
    }

    // Update the repayment record and loan balance in a transaction
    const result = await db.$transaction(async (tx) => {
      const updatedRepayment = await tx.loanRepayment.update({
        where: { id },
        data: {
          amount: data.amount,
          channel: data.channel,
          mobileMoneyRef:
            data.channel === "Mobile Money" ? data.mobileMoneyRef : null,
        },
      });

      // Update loan balance
      const newAmountPaid = existingRepayment.loan.amountPaid + amountDifference;

      // Determine new loan status
      let newStatus = existingRepayment.loan.status;
      if (newBalance <= 0) {
        newStatus = "REPAID";
      } else if (existingRepayment.loan.status === "REPAID" && newBalance > 0) {
        newStatus = "DISBURSED";
      }

      await tx.loan.update({
        where: { id: existingRepayment.loanId },
        data: {
          outstandingBalance: Math.max(0, newBalance),
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // Update related transaction if it exists
      const existingTransaction = await tx.transaction.findFirst({
        where: {
          transactionRef: `LR-${id}`,
        },
      });

      if (existingTransaction) {
        await tx.transaction.update({
          where: { id: existingTransaction.id },
          data: {
            amount: data.amount,
            channel: data.channel,
            externalReference:
              data.channel === "Mobile Money" ? data.mobileMoneyRef : null,
            description: `Updated loan repayment for loan ${existingRepayment.loanId}`,
          },
        });
      }

      return updatedRepayment;
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-repayments");
    revalidatePath(`/dashboard/loan-repayments/${id}`);

    return NextResponse.json({
      success: true,
      repayment: result,
      message: "Loan repayment updated successfully",
    });
  } catch (error) {
    console.error("Error updating loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to update loan repayment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/loan-repayments/[id]
 * Reverse/Delete a loan repayment
 * Only allowed for ADMIN or BRANCHMANAGER
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user || !["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized access - Admin or Branch Manager required" },
        { status: 403 }
      );
    }

    const { id } = await props.params;

    // Get the repayment details
    const repayment = await db.loanRepayment.findUnique({
      where: { id },
      include: {
        loan: true,
      },
    });

    if (!repayment) {
      return NextResponse.json({ error: "Repayment not found" }, { status: 404 });
    }

    // Process deletion in a transaction
    await db.$transaction(async (tx) => {
      // Reverse the loan balance changes
      const newOutstandingBalance =
        repayment.loan.outstandingBalance + repayment.amount;
      const newAmountPaid = Math.max(
        0,
        repayment.loan.amountPaid - repayment.amount
      );

      // Determine new loan status
      let newStatus = repayment.loan.status;
      if (repayment.loan.status === "REPAID" && newOutstandingBalance > 0) {
        newStatus = "DISBURSED";
      }

      // Update loan balance
      await tx.loan.update({
        where: { id: repayment.loanId },
        data: {
          outstandingBalance: newOutstandingBalance,
          amountPaid: newAmountPaid,
          status: newStatus,
        },
      });

      // Delete the repayment record
      await tx.loanRepayment.delete({
        where: { id },
      });

      // Delete related transaction if it exists
      await tx.transaction.deleteMany({
        where: {
          transactionRef: `LR-${id}`,
        },
      });
    });

    // Revalidate relevant paths
    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard/loan-repayments");

    return NextResponse.json({
      success: true,
      message: "Loan repayment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to delete loan repayment" },
      { status: 500 }
    );
  }
}
