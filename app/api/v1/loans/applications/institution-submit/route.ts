import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { LoanStatus, LoanStage } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id;
    const data = await request.json();

    const { institutionId, loanProductId, amountApplied, purpose } = data;

    if (!institutionId || !loanProductId || !amountApplied || !purpose) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [institution, loanProduct] = await Promise.all([
      db.institution.findUnique({ where: { id: institutionId } }),
      db.loanProduct.findUnique({ where: { id: loanProductId } }),
    ]);

    if (!institution) return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    if (!loanProduct || !loanProduct.isActive) return NextResponse.json({ error: "Loan product not found or inactive" }, { status: 404 });

    if (Number(amountApplied) < loanProduct.minAmount || Number(amountApplied) > loanProduct.maxAmount) {
      return NextResponse.json({
        error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}`,
      }, { status: 400 });
    }

    let repaymentPeriod: number | undefined;
    if (data.repaymentPeriodMonths !== undefined && data.repaymentPeriodMonths !== null && data.repaymentPeriodMonths !== "") {
      const parsed = parseInt(String(data.repaymentPeriodMonths), 10);
      if (!isNaN(parsed)) repaymentPeriod = parsed;
    }

    const createData: any = {
      loanProductId,
      institutionId,
      amountApplied: Number(amountApplied),
      purpose,
      collateralOffered: data.collateralOffered || null,
      status: LoanStatus.PENDING,
      stage: LoanStage.SUBMITTED,
      guarantors: data.guarantors || null,
      administrators: data.administrators || null,
      operatingInstructions: data.operatingInstructions || null,
      changeOfSignatoryInstructions: data.changeOfSignatoryInstructions || null,
      accountTitle: data.accountTitle || null,
      accountType: data.accountType || null,
      hasRegistrationCertificate: data.hasRegistrationCertificate || false,
      hasLCRecommendation: data.hasLCRecommendation || false,
      hasVicarRecommendation: data.hasVicarRecommendation || false,
      hasMinutes: data.hasMinutes || false,
      hasByeLaws: data.hasByeLaws || false,
      hasDissolutionResolution: data.hasDissolutionResolution || false,
      annualRevenue: data.annualRevenue || null,
      monthlyRevenue: data.monthlyRevenue || null,
      annualExpenses: data.annualExpenses || null,
      monthlyExpenses: data.monthlyExpenses || null,
      netMonthlyIncome: data.netMonthlyIncome || null,
      applyLoanProcessingFee: data.applyLoanProcessingFee || false,
      loanProcessingFeePercentage: data.loanProcessingFeePercentage || null,
      applyLoanInsurance: data.applyLoanInsurance || false,
      loanInsurancePercentage: data.loanInsurancePercentage || null,
      applyShareDeduction: data.applyShareDeduction || false,
      shareAmount: data.shareAmount || null,
      applyLoanApplicationFee: data.applyApplicationFee || false,
      loanApplicationFeePercentage: data.loanApplicationFeePercentage || null,
      applyLoanStationeryFee: data.applyStationeryFee || false,
      loanStationeryFeeAmount: data.loanStationeryFeeAmount || null,
      applyLoanCommitmentFee: data.applyCommitmentFee || false,
      loanCommitmentFeePercentage: data.loanCommitmentFeePercentage || null,
      bankName: data.bankName || null,
      bankBranch: data.bankBranch || null,
      bankAccountNumber: data.bankAccountNumber || null,
      mobileMoneyNumber: data.mobileMoneyNumber || null,
      applicantDeclaration: data.applicantDeclaration || false,
      applicantSignature: data.applicantSignature || null,
      gracePeriod: data.gracePeriod || 0,
      interestType: data.interestType || loanProduct.interestType,
      interestPeriod: data.interestPeriod || loanProduct.interestPeriod,
      applicantUserId: data.currentUserId || userId,
      loanOfficerId: data.currentUserId || userId,
    };

    if (repaymentPeriod !== undefined) createData.repaymentPeriodMonths = repaymentPeriod;

    const loanApplication = await db.institutionLoanApplication.create({
      data: createData,
      include: {
        institution: { include: { user: true } },
        loanProduct: true,
      },
    });

    return NextResponse.json({ success: true, data: loanApplication });
  } catch (error) {
    console.error("Error creating institution loan application:", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
