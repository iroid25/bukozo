// FILE: actions/loanWriteOffs.ts
"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { revalidatePath } from "next/cache";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);

// Get loans eligible for write-off
export async function getEligibleLoansForWriteOff() {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const allowedRoles = [
      "LOANOFFICER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
    ];

    if (!allowedRoles.includes(user.role)) {
      throw new Error("Unauthorized access");
    }

    const loans = await db.loan.findMany({
      where: {
        status: {
          in: ["OVERDUE", "DISBURSED"],
        },
        outstandingBalance: {
          gt: 0,
        },
      },
      include: {
        member: {
          include: {
            user: true,
            accounts: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        repayments: true,
        writeOffs: {
          where: {
            status: {
              in: ["PENDING", "APPROVED"],
            },
          },
        },
      },
      orderBy: {
        disbursementDate: "desc",
      },
    });

    const eligibleLoans = loans.filter((loan) => loan.writeOffs.length === 0);

    return eligibleLoans;
  } catch (error) {
    console.error("Error fetching eligible loans:", error);
    return [];
  }
}

// Create write-off request
export async function createLoanWriteOffRequest(data: {
  loanId: string;
  reason: string;
  minuteNumber?: string;
  notes?: string;
}) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const allowedRoles = ["LOANOFFICER", "ADMIN"];

    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "Only loan officers can create write-off requests",
      };
    }

    const loan = await db.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: {
          include: {
            user: true,
            accounts: true,
          },
        },
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        repayments: true,
      },
    });

    if (!loan) {
      return {
        success: false,
        error: "Loan not found",
      };
    }

    const existingWriteOff = await db.loanWriteOff.findFirst({
      where: {
        loanId: data.loanId,
        status: {
          in: ["PENDING", "APPROVED"],
        },
      },
    });

    if (existingWriteOff) {
      return {
        success: false,
        error: "This loan already has a pending or approved write-off request",
      };
    }

    const totalPaid = loan.amountPaid;
    const totalBalance = loan.outstandingBalance;

    const interestAmount = loan.totalAmountDue - loan.amountGranted;
    const principalPortion = loan.amountGranted;

    const paymentRatio = totalPaid / loan.totalAmountDue;
    const principalPaid = principalPortion * paymentRatio;
    const interestPaid = totalPaid - principalPaid;

    const principalBalance = loan.amountGranted - principalPaid;
    const interestBalance = totalBalance - principalBalance;

    const writeOff = await db.loanWriteOff.create({
      data: {
        loanId: data.loanId,
        amountDisbursed: loan.amountGranted,
        principalPaid: principalPaid,
        interestPaid: interestPaid,
        penaltyPaid: 0,
        totalPaid: totalPaid,
        principalBalance: principalBalance,
        interestBalance: interestBalance,
        penaltyBalance: 0,
        totalBalance: totalBalance,
        reason: data.reason,
        minuteNumber: data.minuteNumber || null,
        notes: data.notes || null,
        requestedByUserId: user.id,
        status: "PENDING",
      },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
        requestedBy: true,
      },
    });

    const managers = await db.user.findMany({
      where: {
        role: {
          in: ["BRANCHMANAGER", "ADMIN"],
        },
        isActive: true,
      },
    });

    for (const manager of managers) {
      await db.notification.create({
        data: {
          userId: manager.id,
          type: "IN_APP",
          subject: "New Loan Write-Off Request",
          message: `${user.name} has requested to write off a loan for ${loan.member.user.name}. Amount: ${formatCurrency(totalBalance)}`,
          targetAddress: `/dashboard/loan-write-offs`,
          sentAt: new Date(),
          isRead: false,
          status: "SENT",
        },
      });
    }

    revalidatePath("/dashboard/loan-write-offs");

    return {
      success: true,
      message: "Write-off request created successfully",
      writeOff,
    };
  } catch (error) {
    console.error("Error creating write-off request:", error);
    return {
      success: false,
      error: "Failed to create write-off request",
    };
  }
}

// Get all write-off requests
export async function getAllWriteOffRequests() {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    let whereCondition: any = {};

    if (user.role === "LOANOFFICER") {
      whereCondition.requestedByUserId = user.id;
    } else if (
      !["BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "AUDITOR"].includes(user.role)
    ) {
      throw new Error("Unauthorized access");
    }

    const writeOffs = await db.loanWriteOff.findMany({
      where: whereCondition,
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
                accounts: true,
              },
            },
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
        requestedBy: true,
        approvedBy: true,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });

    return writeOffs;
  } catch (error) {
    console.error("Error fetching write-off requests:", error);
    return [];
  }
}

// Approve write-off
export async function approveLoanWriteOff(
  writeOffId: string,
  targetAccountId?: string
) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const allowedRoles = ["BRANCHMANAGER", "ADMIN"];

    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "Only managers can approve write-off requests",
      };
    }

    const writeOff = await db.loanWriteOff.findUnique({
      where: { id: writeOffId },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
                accounts: true,
              },
            },
          },
        },
        requestedBy: true,
      },
    });

    if (!writeOff) {
      return {
        success: false,
        error: "Write-off request not found",
      };
    }

    // This legacy action only ever handles individual-loan write-offs.
    // Institution loan write-offs are created via /api/v1/loan-write-offs
    // and approved via its dedicated route, which does support both.
    if (!writeOff.loan) {
      return {
        success: false,
        error: "This action does not support institution loan write-offs — use the loan write-offs page instead.",
      };
    }
    const loan = writeOff.loan;

    if (writeOff.status !== "PENDING") {
      return {
        success: false,
        error: "This write-off has already been processed",
      };
    }

    // specific account validation
    let accountIdToUse = targetAccountId;
    if (accountIdToUse) {
      const accountExists = loan.member.accounts.find(
        (a) => a.id === accountIdToUse
      );
      if (!accountExists) {
        return {
          success: false,
          error: "Selected account does not belong to the member",
        };
      }
    } else if (loan.member.accounts.length > 0) {
      // Fallback to first account if none selected, but ideally explicit selection is better
      // For now, we keep backward compatibility or auto-selection if only 1 account exists
      accountIdToUse = loan.member.accounts[0].id;
    }

    await db.$transaction(async (tx) => {
      await tx.loanWriteOff.update({
        where: { id: writeOffId },
        data: {
          status: "APPROVED",
          approvedByUserId: user.id,
          approvedAt: new Date(),
          dateWrittenOff: new Date(),
        },
      });

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: "WRITTEN_OFF",
          outstandingBalance: 0,
        },
      });

      // Only create transaction if an account is identified
      if (accountIdToUse) {
        await tx.transaction.create({
          data: {
            transactionRef: `WO-${writeOffId.slice(0, 8)}`,
            memberId: loan.memberId,
            accountId: accountIdToUse,
            type: "OTHER",
            amount: writeOff.totalBalance,
            status: "COMPLETED",
            description: `Loan write-off approved - ${writeOff.reason}`,
            transactionDate: new Date(),
            processedByUserId: user.id,
            channel: "WRITE_OFF",
            loanId: loan.id,
          },
        });
      }
    });

    await db.notification.create({
      data: {
        userId: writeOff.requestedByUserId,
        type: "IN_APP",
        subject: "Write-Off Request Approved",
        message: `Your write-off request for ${loan.member.user.name}'s loan has been approved by ${user.name}`,
        targetAddress: `/dashboard/loan-write-offs`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    revalidatePath("/dashboard/loan-write-offs");
    revalidatePath("/dashboard/loans");

    return {
      success: true,
      message: "Write-off approved successfully",
    };
  } catch (error) {
    console.error("Error approving write-off:", error);
    return {
      success: false,
      error: "Failed to approve write-off",
    };
  }
}

// Reject write-off
export async function rejectLoanWriteOff(writeOffId: string, reason: string) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const allowedRoles = ["BRANCHMANAGER", "ADMIN"];

    if (!allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: "Only managers can reject write-off requests",
      };
    }

    const writeOff = await db.loanWriteOff.findUnique({
      where: { id: writeOffId },
      include: {
        loan: {
          include: {
            member: {
              include: {
                user: true,
              },
            },
          },
        },
        requestedBy: true,
      },
    });

    if (!writeOff) {
      return {
        success: false,
        error: "Write-off request not found",
      };
    }

    if (writeOff.status !== "PENDING") {
      return {
        success: false,
        error: "This write-off has already been processed",
      };
    }

    await db.loanWriteOff.update({
      where: { id: writeOffId },
      data: {
        status: "REJECTED",
        approvedByUserId: user.id,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    const borrowerName = writeOff.loan?.member?.user?.name || "the borrower";
    await db.notification.create({
      data: {
        userId: writeOff.requestedByUserId,
        type: "IN_APP",
        subject: "Write-Off Request Rejected",
        message: `Your write-off request for ${borrowerName}'s loan has been rejected. Reason: ${reason}`,
        targetAddress: `/dashboard/loan-write-offs`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    revalidatePath("/dashboard/loan-write-offs");

    return {
      success: true,
      message: "Write-off rejected successfully",
    };
  } catch (error) {
    console.error("Error rejecting write-off:", error);
    return {
      success: false,
      error: "Failed to reject write-off",
    };
  }
}

// Get write-off statistics
export async function getWriteOffStatistics() {
  try {
    const user = await getAuthUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const [pending, approved, rejected, totalAmount] = await Promise.all([
      db.loanWriteOff.count({
        where: { status: "PENDING" },
      }),
      db.loanWriteOff.count({
        where: { status: "APPROVED" },
      }),
      db.loanWriteOff.count({
        where: { status: "REJECTED" },
      }),
      db.loanWriteOff.aggregate({
        where: { status: "APPROVED" },
        _sum: { totalBalance: true },
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
      totalAmount: totalAmount._sum.totalBalance || 0,
    };
  } catch (error) {
    console.error("Error fetching write-off statistics:", error);
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
    };
  }
}
