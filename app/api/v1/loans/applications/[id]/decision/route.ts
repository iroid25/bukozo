import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { LoanService } from "@/services/loan.service";

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().optional(),
  amountGranted: z.number().positive().optional(),
  repaymentPeriodMonths: z.number().int().positive().optional(),
  loanOfficerId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify approver has permission
    const approver = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true, email: true },
    });

    if (
      !approver ||
      !["ADMIN", "BRANCHMANAGER"].includes(approver.role)
    ) {
      return NextResponse.json(
        { error: "You don't have permission to approve loan applications" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = decisionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { status, rejectionReason, amountGranted, repaymentPeriodMonths } = validation.data;

    // First, try to find as an individual LoanApplication
    const individualApp = await db.loanApplication.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (individualApp) {
      // Handle individual loan application decision
      let result;
      if (status === "APPROVED") {
        result = await LoanService.approve({
          applicationId: params.id,
          managerId: session.user.id,
          approvedAmount: amountGranted || 0,
          approvedRepaymentPeriod: repaymentPeriodMonths,
          tellerId: validation.data.loanOfficerId,
        });
      } else {
        result = await LoanService.reject({
          applicationId: params.id,
          managerId: session.user.id,
          reason: rejectionReason || "No reason provided",
        });
      }

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json(result.data);
    }

    // If not found as individual, try as InstitutionLoanApplication
    const institutionApp = await db.institutionLoanApplication.findUnique({
      where: { id: params.id },
      include: {
        loanProduct: true,
        institution: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!institutionApp) {
      return NextResponse.json(
        { error: "Loan application not found" },
        { status: 404 }
      );
    }

    if (institutionApp.status !== "PENDING") {
      return NextResponse.json(
        { error: "This application has already been processed" },
        { status: 400 }
      );
    }

    if (status === "APPROVED") {
      const approvedAmt = amountGranted || institutionApp.amountApplied;
      const repaymentMonths = repaymentPeriodMonths || institutionApp.repaymentPeriodMonths || Math.round(institutionApp.loanProduct.repaymentPeriodDays / 30);
      
      // Calculate interest (Preliminary calculation for approval summary)
      const interestRate = institutionApp.loanProduct.interestRate;
      const monthlyRate = institutionApp.interestPeriod === "ANNUAL" 
        ? interestRate / 12 
        : interestRate;
      const totalInterest = approvedAmt * (monthlyRate / 100) * repaymentMonths;
      const totalAmountDue = approvedAmt + totalInterest;

      // Calculate preliminary due date
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + repaymentMonths);

      // Update application and create institution loan in a transaction
      const result = await db.$transaction(async (tx) => {
        // Update the application
        const updatedApp = await tx.institutionLoanApplication.update({
          where: { id: params.id },
          data: {
            status: "APPROVED",
            stage: "APPROVED",
            approvalDate: now,
            approvedAmount: approvedAmt,
            repaymentPeriodMonths: repaymentMonths,
            loanOfficerId: validation.data.loanOfficerId || null,
          },
        });

        // Create the InstitutionLoan with APPROVED status (moves to disbursement queue)
        const institutionLoan = await tx.institutionLoan.create({
          data: {
            applicationId: params.id,
            institutionId: institutionApp.institutionId,
            amountGranted: approvedAmt,
            interestRate: interestRate,
            totalAmountDue: totalAmountDue,
            outstandingBalance: totalAmountDue,
            disbursementDate: null, // Not yet disbursed
            dueDate: dueDate,
            status: "APPROVED",
            allocatedTellerId: validation.data.loanOfficerId || null,
          },
        });

        // Notify Loan Officer if assigned
        if (validation.data.loanOfficerId) {
          await tx.notification.create({
            data: {
              userId: validation.data.loanOfficerId,
              type: "IN_APP",
              subject: "New Institution Loan Assigned",
              message: `Institution loan of UGX ${approvedAmt.toLocaleString()} for ${institutionApp.institution.institutionName} has been assigned to you for disbursement.`,
              targetAddress: `/dashboard/loanprocess/disbursement-queue`,
              sentAt: new Date(),
              status: "SENT",
            },
          });
        }

        // Notify Institution
        await tx.notification.create({
          data: {
            userId: institutionApp.institution.user.id,
            type: "IN_APP",
            subject: "Loan Application Approved",
            message: `Your loan application for UGX ${approvedAmt.toLocaleString()} has been APPROVED. It is now awaiting disbursement.`,
            targetAddress: `/dashboard/loans/institution-loan-process-tracking`,
            sentAt: new Date(),
            status: "SENT",
          },
        });

        return { application: updatedApp, loan: institutionLoan };
      });

      return NextResponse.json({
        success: true,
        message: "Institution loan application approved and moved to disbursement queue",
        data: result,
      });
    } else {
      // Reject
      const updatedApp = await db.institutionLoanApplication.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          stage: "REJECTED",
          rejectionReason: rejectionReason || "No reason provided",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Institution loan application rejected",
        data: updatedApp,
      });
    }
  } catch (error) {
    console.error("Error deciding loan application:", error);
    return NextResponse.json(
      { error: "Failed to process loan application decision" },
      { status: 500 }
    );
  }
}
