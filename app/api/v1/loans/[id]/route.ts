// @ts-nocheck
// app/api/v1/loans/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { Prisma } from "@prisma/client";

// Type definition for loan with all relations and counts
type LoanWithFullRelations = Prisma.LoanGetPayload<{
  include: {
    loanApplication: {
      include: {
        loanProduct: true;
        allocatedTeller: true;
        applicant: true;
        approver: true;
      };
    };
    member: {
      include: {
        user: true;
        accounts: {
          where: { status: "ACTIVE" };
          include: {
            accountType: true;
            branch: true;
          };
        };
      };
    };
    disbursedByUser: true;
    allocatedTeller: true;
    branch: true;
    repayments: {
      include: {
        handler: true;
      };
    };
    writeOffs: {
      include: {
        requestedBy: true;
        approvedBy: true;
      };
    };
    _count: {
      select: {
        repayments: true;
        repaymentRequests: true;
        writeOffs: true;
      };
    };
  };
}>;

/**
 * GET /api/v1/loans/[id]
 * Get detailed loan information
 * Auth: Required (LOANOFFICER, TELLER, BRANCHMANAGER, ADMIN, ACCOUNTANT, AUDITOR)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Authorization
    const allowedRoles = [
      "LOANOFFICER",
      "TELLER",
      "BRANCHMANAGER",
      "ADMIN",
      "ACCOUNTANT",
      "AUDITOR",
    ];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 },
      );
    }

    // Await params (Next.js 15)
    const params = await props.params;
    const { id } = params;

    // Fetch loan with comprehensive relations
    let loan = await db.loan.findUnique({
      where: { id },
      include: {
        loanApplication: {
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                description: true,
                interestRate: true,
                interestType: true,
                interestPeriod: true,
                minAmount: true,
                maxAmount: true,
                repaymentPeriodDays: true,
              },
            },
            applyLoanProcessingFee: true,
            loanProcessingFeePercentage: true,
            applyLoanInsurance: true,
            loanInsurancePercentage: true,
            applyShareDeduction: true,
            shareAmount: true,
            existingLoanBalance: true,
            repaymentPeriodMonths: true,
            repaymentStartDate: true,
            gracePeriod: true,
            disbursementMethod: true,
            allocatedTeller: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
              },
            },
            applicant: { select: { id: true, name: true, role: true } },
            approver: { select: { id: true, name: true, role: true } },
            loanOfficer: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
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
                address: true,
              },
            },
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: {
                  select: {
                    id: true,
                    name: true,
                    interestRate: true,
                    minBalance: true,
                  },
                },
                branch: { select: { id: true, name: true, location: true } },
              },
            },
          },
        },
        disbursedByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
        allocatedTeller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
            contactPhone: true,
            email: true,
            contactPerson: true,
          },
        },
        repayments: {
          include: {
            handler: { select: { id: true, name: true, role: true } },
          },
          orderBy: { repaymentDate: "desc" },
        },
        writeOffs: {
          include: {
            requestedBy: { select: { id: true, name: true, role: true } },
            approvedBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { requestedAt: "desc" },
        },
        schedules: {
          orderBy: { period: "asc" },
        },
        _count: {
          select: {
            repayments: true,
            repaymentRequests: true,
            writeOffs: true,
          },
        },
      },
    });

    if (!loan) {
      // Try fetching Institution Loan
      const instLoan = await db.institutionLoan.findUnique({
        where: { id },
        include: {
          application: {
            include: {
              loanProduct: true,
              loanOfficer: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
          },
          institution: {
            include: {
              user: true,
              accounts: {
                include: {
                  accountType: true,
                  branch: true,
                },
              },
            },
          },
          allocatedTeller: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      if (!instLoan) {
        return NextResponse.json(
          { success: false, error: "Loan not found" },
          { status: 404 },
        );
      }

      // Fetch separately to bypass stale client include error
      const instRepayments = await (
        db as any
      ).institutionLoanRepayment.findMany({
        where: { loanId: id },
        orderBy: { repaymentDate: "desc" },
      });

      const instSchedules = await (
        db as any
      ).institutionLoanRepaymentSchedule.findMany({
        where: { loanId: id },
        orderBy: { period: "asc" },
      });

      // Map Institution Loan to match individual loan structure
      loan = {
        ...instLoan,
        isInstitution: true,
        loanApplication: {
          ...instLoan.application,
          loanProduct: instLoan.application.loanProduct,
          loanOfficer: instLoan.application.loanOfficer,
        },
        member: {
          ...instLoan.institution,
          user: instLoan.institution.user,
        },
        repayments: instRepayments,
        schedules: instSchedules,
        branch: instLoan.institution.user?.branchId
          ? await db.branch.findUnique({
              where: { id: instLoan.institution.user.branchId },
            })
          : null,
        _count: {
          repayments: instRepayments.length,
          repaymentRequests: 0,
          writeOffs: 0,
        },
      };
    }

    // Branch-level access control
    if (user.role === "BRANCHMANAGER" && user.branchId !== loan.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied - Different branch" },
        { status: 403 },
      );
    }

    // Auto-update overdue status
    const now = new Date();
    const dueDate = new Date(loan.dueDate);
    if (
      now > dueDate &&
      loan.outstandingBalance > 0 &&
      loan.status === "DISBURSED"
    ) {
      await db.loan.update({
        where: { id },
        data: { status: "OVERDUE" },
      });
      loan.status = "OVERDUE";
    }

    // Calculate additional metrics
    const repaymentProgress =
      Number(loan.totalAmountDue) > 0
        ? (Number(loan.amountPaid) / Number(loan.totalAmountDue)) * 100
        : 0;

    const daysOverdue =
      loan.status === "OVERDUE"
        ? Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

    let penaltyRate = 0.02;
    if (daysOverdue >= 180) penaltyRate = 0.24;
    else if (daysOverdue >= 90) penaltyRate = 0.12;
    else if (daysOverdue >= 60) penaltyRate = 0.09;
    else if (daysOverdue >= 30) penaltyRate = 0.06;

    const accruedPenalty =
      daysOverdue > 0
        ? Math.max(
            0,
            Number(loan.outstandingBalance) * penaltyRate -
              (loan.penaltyPaid || 0),
          )
        : 0;

    const daysUntilDue =
      loan.status !== "REPAID" && loan.status !== "WRITTEN_OFF"
        ? Math.floor(
            (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0;

    const averageRepaymentAmount =
      loan._count.repayments > 0
        ? Number(loan.amountPaid) / loan._count.repayments
        : 0;

    const enrichedLoan = {
      ...loan,
      interestPeriod: loan.interestPeriod || "MONTHLY",
      metrics: {
        repaymentProgress: Math.round(repaymentProgress * 100) / 100,
        daysOverdue,
        accruedPenalty: Math.round(accruedPenalty * 100) / 100,
        daysUntilDue,
        totalRepayments: loan._count.repayments,
        averageRepaymentAmount: Math.round(averageRepaymentAmount * 100) / 100,
        remainingAmount: Number(loan.outstandingBalance),
        paidPercentage:
          Math.round(
            (Number(loan.amountPaid) / Number(loan.totalAmountDue)) * 10000,
          ) / 100,
        isOverdue: loan.status === "OVERDUE",
        isFullyPaid: loan.status === "REPAID",
        hasWriteOff: loan._count.writeOffs > 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: enrichedLoan,
    });
  } catch (error) {
    console.error("Error fetching loan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch loan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/loans/[id]
 * Update loan details
 * Auth: Required (LOANOFFICER, BRANCHMANAGER, ADMIN)
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Authorization
    const allowedRoles = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Insufficient permissions" },
        { status: 403 },
      );
    }

    // Await params (Next.js 15)
    const params = await props.params;
    const { id } = params;
    const body = await request.json();

    // Get existing loan
    const existingLoan = await db.loan.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!existingLoan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    // Branch-level access control
    if (
      user.role === "BRANCHMANAGER" &&
      user.branchId !== existingLoan.branchId
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied - Different branch" },
        { status: 403 },
      );
    }

    // Validate updateable fields
    const {
      status,
      dueDate,
      allocatedTellerId,
      disbursementMethod,
      isRescheduled,
    } = body;

    const updateData: any = {};

    if (status) {
      const validStatuses = [
        "PENDING",
        "APPROVED",
        "DISBURSED",
        "OVERDUE",
        "REPAID",
        "WRITTEN_OFF",
        "REJECTED",
        "UNDER_REVIEW",
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          },
          { status: 400 },
        );
      }
      updateData.status = status;
    }

    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }

    if (allocatedTellerId !== undefined) {
      updateData.allocatedTellerId = allocatedTellerId;
    }

    if (disbursementMethod !== undefined) {
      updateData.disbursementMethod = disbursementMethod;
    }

    if (isRescheduled !== undefined) {
      updateData.isRescheduled = isRescheduled;
    }

    // Update loan
    const updatedLoan = await db.loan.update({
      where: { id },
      data: updateData,
      include: {
        loanApplication: {
          include: {
            loanProduct: true,
          },
        },
        member: {
          include: {
            user: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOAN_UPDATE",
        entityType: "Loan",
        entityId: id,
        oldValue: existingLoan,
        newValue: updateData,
        details: `Loan updated. Changes: ${JSON.stringify(updateData)}`,
        timestamp: new Date(),
      },
    });

    // Send notification if status changed
    if (status && status !== existingLoan.status) {
      const statusMessages: Record<string, string> = {
        APPROVED: "Your loan has been approved!",
        DISBURSED: "Your loan has been disbursed to your account.",
        OVERDUE:
          "Your loan payment is overdue. Please make a payment as soon as possible.",
        REPAID: "Congratulations! Your loan has been fully repaid.",
        WRITTEN_OFF: "Your loan has been written off.",
        REJECTED: "Your loan application has been rejected.",
      };

      if (statusMessages[status]) {
        await db.notification.create({
          data: {
            userId: existingLoan.member.userId,
            type: "IN_APP",
            subject: "Loan Status Update",
            message: statusMessages[status],
            targetAddress: `/dashboard/loans/${id}`,
            sentAt: new Date(),
            isRead: false,
            status: "SENT",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Loan updated successfully",
      data: updatedLoan,
    });
  } catch (error) {
    console.error("Error updating loan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update loan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/loans/[id]
 * Delete a loan (only if no repayments have been made)
 * Auth: Required (ADMIN only)
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    // Authentication
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Authentication required" },
        { status: 401 },
      );
    }

    // Authorization - Admin only
    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    // Await params (Next.js 15)
    const params = await props.params;
    const { id } = params;

    // Check if loan exists and has repayments
    const loan = (await db.loan.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            repayments: true,
            repaymentRequests: true,
            writeOffs: true,
          },
        },
      },
    })) as Prisma.LoanGetPayload<{
      include: {
        member: {
          include: {
            user: true;
          };
        };
        _count: {
          select: {
            repayments: true;
            repaymentRequests: true;
            writeOffs: true;
          };
        };
      };
    }> | null;

    if (!loan) {
      return NextResponse.json(
        { success: false, error: "Loan not found" },
        { status: 404 },
      );
    }

    if (loan._count.repayments > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete loan with existing repayments. Consider marking as written off instead.",
        },
        { status: 400 },
      );
    }

    if (loan._count.writeOffs > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete loan with write-off records.",
        },
        { status: 400 },
      );
    }

    if (loan.status === "DISBURSED" || loan.status === "OVERDUE") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete a disbursed loan. Consider marking as written off.",
        },
        { status: 400 },
      );
    }

    // Delete loan
    await db.loan.delete({
      where: { id },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOAN_DELETE",
        entityType: "Loan",
        entityId: id,
        details: `Loan deleted for member: ${loan.member.user.name}`,
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Loan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting loan:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete loan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
