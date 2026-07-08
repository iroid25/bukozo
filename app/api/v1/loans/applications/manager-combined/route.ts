import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { LoanService } from "@/services/loan.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "BRANCHMANAGER"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const individualWhere: any = {};
    const institutionWhere: any = {};

    if (currentUser.role === "BRANCHMANAGER" && currentUser.branchId) {
      individualWhere.member = { user: { branchId: currentUser.branchId } };
      institutionWhere.institution = { user: { branchId: currentUser.branchId } };
    }

    const [applicationsResponse, institutionAppsResponse, statisticsResponse, tellersList] =
      await Promise.all([
        db.loanApplication.findMany({
          where: individualWhere,
          take: 200,
          include: {
            loanProduct: true,
            member: {
              include: {
                user: { select: { name: true, email: true, phone: true, image: true } },
                accounts: {
                  where: { status: "ACTIVE" },
                  take: 1,
                  orderBy: { openedAt: "asc" },
                  select: { id: true, accountNumber: true, balance: true },
                },
              },
            },
            approver: { select: { id: true, name: true, role: true } },
            applicant: { select: { id: true, name: true, role: true } },
            loanOfficer: { select: { id: true, name: true, role: true } },
            allocatedTeller: { select: { id: true, name: true, role: true } },
            loan: {
              select: {
                id: true,
                amountGranted: true,
                totalAmountDue: true,
                outstandingBalance: true,
                disbursementDate: true,
                dueDate: true,
              },
            },
          },
          orderBy: { applicationDate: "desc" },
        }),
        db.institutionLoanApplication.findMany({
          where: institutionWhere,
          take: 200,
          include: {
            loanProduct: true,
            institution: {
              include: {
                user: { select: { name: true, email: true, phone: true, image: true, branchId: true } },
                accounts: {
                  where: { status: "ACTIVE" },
                  take: 1,
                  select: { id: true, accountNumber: true, balance: true },
                },
              },
            },
            institutionLoan: true,
            loanOfficer: { select: { id: true, name: true, role: true } },
            applicantUser: { select: { id: true, name: true, role: true } },
          },
          orderBy: { applicationDate: "desc" },
        }),
        LoanService.getApplicationStatistics({
          branchId: currentUser.branchId || undefined,
        }),
        db.user.findMany({
          where: {
            role: "LOANOFFICER",
            isActive: true,
            branchId: currentUser.branchId || undefined,
          },
          include: { branch: { select: { name: true } } },
        }),
      ]);

    const statsData = statisticsResponse.ok
      ? statisticsResponse.data
      : { pending: 0, approved: 0, rejected: 0, disbursed: 0, totalAmount: 0 };

    const institutionPending = institutionAppsResponse.filter(
      (app: any) => app.status === "PENDING"
    ).length;
    if (statsData && typeof statsData.pending === "number") {
      (statsData as any).pending += institutionPending;
      if (typeof (statsData as any).totalPending === "number") {
        (statsData as any).totalPending += institutionPending;
      }
    }

    const individualApplications = applicationsResponse.map((app: any) => ({
      ...app,
      isInstitution: false,
      institutionName: undefined,
      applyLoanProcessingFee: app.applyLoanProcessingFee ?? undefined,
      loanProcessingFeePercentage: app.loanProcessingFeePercentage ?? undefined,
      applyLoanInsurance: app.applyLoanInsurance ?? undefined,
      loanInsurancePercentage: app.loanInsurancePercentage ?? undefined,
      applyShareDeduction: app.applyShareDeduction ?? undefined,
      shareAmount: app.shareAmount ?? undefined,
      hasExistingLoanWithSacco: app.hasExistingLoanWithSacco ?? undefined,
      existingLoanBalance: app.existingLoanBalance ?? undefined,
      employer: app.employer ?? undefined,
      employmentStatus: app.employmentStatus ?? undefined,
      grossMonthlyIncome: app.grossMonthlyIncome ?? undefined,
      netMonthlyIncome: app.netMonthlyIncome ?? undefined,
      repaymentPeriodMonths: app.repaymentPeriodMonths ?? undefined,
      purpose: app.purpose ?? undefined,
      collateralType: app.collateralType ?? undefined,
      collateralValue: app.collateralValue ?? undefined,
      approvalDate: app.approvalDate ?? undefined,
      rejectionReason: app.rejectionReason ?? undefined,
      guarantors: app.guarantors ?? undefined,
      loan: app.loan ?? undefined,
      approver: app.approver ?? undefined,
    }));

    const institutionApplications = institutionAppsResponse.map((instApp: any) => ({
      id: instApp.id,
      isInstitution: true,
      institutionName: instApp.institution.institutionName,
      memberId: instApp.institutionId,
      member: {
        id: instApp.institutionId,
        memberNumber: instApp.institution.institutionNumber || "INST",
        user: {
          name: `🏢 ${instApp.institution.institutionName}`,
          email: instApp.institution.institutionEmail || instApp.institution.user.email,
          phone: instApp.institution.institutionPhone || instApp.institution.user.phone,
          image: instApp.institution.user.image || null,
        },
        accounts: instApp.institution.accounts || [],
      },
      loanProduct: instApp.loanProduct,
      amountApplied: instApp.amountApplied,
      purpose: instApp.purpose ?? undefined,
      status: instApp.status,
      stage: instApp.stage || instApp.status,
      applicationDate: instApp.applicationDate,
      approvalDate: instApp.approvalDate ?? undefined,
      rejectionReason: instApp.rejectionReason ?? undefined,
      employer: undefined,
      employmentStatus: undefined,
      grossMonthlyIncome: instApp.monthlyRevenue ?? undefined,
      netMonthlyIncome: instApp.netMonthlyIncome ?? undefined,
      repaymentPeriodMonths: instApp.repaymentPeriodMonths ?? undefined,
      guarantors: instApp.guarantors ?? undefined,
      applyLoanProcessingFee: instApp.applyLoanProcessingFee ?? undefined,
      loanProcessingFeePercentage: instApp.loanProcessingFeePercentage ?? undefined,
      applyLoanInsurance: instApp.applyLoanInsurance ?? undefined,
      loanInsurancePercentage: instApp.loanInsurancePercentage ?? undefined,
      applyShareDeduction: instApp.applyShareDeduction ?? undefined,
      shareAmount: instApp.shareAmount ?? undefined,
      hasExistingLoanWithSacco: undefined,
      existingLoanBalance: undefined,
      collateralType: instApp.collateralOffered ? "OTHER" : undefined,
      collateralValue: undefined,
      approver: undefined,
      applicant: instApp.applicantUser ?? undefined,
      loanOfficer: instApp.loanOfficer ?? undefined,
      allocatedTeller: undefined,
      loan: instApp.institutionLoan ?? undefined,
    }));

    const applications = [...individualApplications, ...institutionApplications].sort(
      (a, b) =>
        new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime()
    );

    const loanOfficers = tellersList.map((officer: any) => ({
      value: officer.id,
      label: `${officer.name} - ${officer.role} ${officer.branch ? `(${officer.branch.name})` : ""}`,
    }));

    return NextResponse.json({
      success: true,
      data: { applications, statistics: statsData, loanOfficers },
    });
  } catch (error: any) {
    console.error("Error fetching manager combined applications:", error);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}
