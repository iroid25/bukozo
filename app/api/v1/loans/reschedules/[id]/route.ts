import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only Managers and Admins can approve/reject
    const allowedRoles = ["BRANCHMANAGER", "ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden - Manager access required" },
        { status: 403 }
      );
    }

    const params = await props.params;
    const { id } = params;
    const body = await request.json();
    const { status } = body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    const reschedule = await db.loanReschedule.findUnique({
      where: { id },
      include: {
        loan: true,
        institutionLoan: { include: { institution: { include: { user: true } } } },
      }
    });

    if (!reschedule) {
      return NextResponse.json(
        { success: false, error: "Request not found" },
        { status: 404 }
      );
    }

    const isInstitution = !!reschedule.institutionLoan;
    const effectiveBranchId = isInstitution
      ? reschedule.institutionLoan!.institution.user.branchId
      : reschedule.loan!.branchId;
    const targetLoanId = isInstitution ? reschedule.institutionLoanId! : reschedule.loanId!;

    // Branch Check
    if (user.role === "BRANCHMANAGER" && effectiveBranchId !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Access denied - Different branch" },
        { status: 403 }
      );
    }

    if (reschedule.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Request has already been processed" },
        { status: 400 }
      );
    }

    // Transactional Update
    await db.$transaction(async (tx) => {
      // 1. Update reschedule request
      await tx.loanReschedule.update({
        where: { id },
        data: {
          status,
          approvedById: user.id,
          managerComment: body.managerComment,
          committeeComment: body.committeeComment,
          minuteNumber: body.minuteNumber,
          rescheduleAmount: body.approvedAmount || reschedule.rescheduleAmount,
          village: body.village,
          parish: body.parish,
          county: body.county,
          spouseName: body.spouseName,
          spouseContact: body.spouseContact,
          spouseNIN: body.spouseNIN,
          reschedulePeriod: body.reschedulePeriod,
          securityType: body.securityType,
          securityDescription: body.securityDescription,
          securityPurchasePrice: body.securityPurchasePrice,
          securityCurrentPrice: body.securityCurrentPrice,
          securityValuation: body.securityValuation,
          forcedSaleValue: body.forcedSaleValue,
          guarantors: body.guarantors,
          officerComment: body.officerComment,
        }
      });

      // 2. If APPROVED, update loan due date and set isRescheduled
      if (status === "APPROVED") {
        if (isInstitution) {
          await tx.institutionLoan.update({
            where: { id: reschedule.institutionLoanId! },
            data: {
              dueDate: reschedule.newDueDate,
              isRescheduled: true
            }
          });
        } else {
          await tx.loan.update({
            where: { id: reschedule.loanId! },
            data: {
              dueDate: reschedule.newDueDate,
              isRescheduled: true
            }
          });
        }
      }

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
            userId: user.id,
            action: status === "APPROVED" ? "LOAN_RESCHEDULE_APPROVED" : "LOAN_RESCHEDULE_REJECTED",
            entityType: "LoanReschedule",
            entityId: id,
            details: `Reschedule request ${status} for ${isInstitution ? "institution " : ""}loan ${targetLoanId} by ${user.name}`
        }
      });

      // 4. Create Notification for the loan officer (requester)
       await tx.notification.create({
          data: {
            userId: reschedule.requestedById,
            type: "IN_APP", // Assuming this enum exists, or string
            subject: `Loan Reschedule ${status}`,
            message: `Your reschedule request for loan ${targetLoanId} has been ${status}.`,
            targetAddress: isInstitution
              ? `/dashboard/institution-loan-applications`
              : `/dashboard/loans/${targetLoanId}`,
            status: "SENT"
          }
       });
    });

    return NextResponse.json({
      success: true,
      message: `Reschedule request ${status.toLowerCase()} successfully`
    });

  } catch (error) {
    console.error("Update reschedule error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
