import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { sendLoanApplicationEmail } from "@/lib/email";
import { recordLoanInsuranceCollection } from "@/lib/services/loanInsurance";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";
import { LOAN_PROCESSING_FEES_CODE } from "@/lib/services/income-structure";
import { findActiveAccountByCodes } from "@/lib/accounting/coa-identity";

// Schema for creating a loan application
const createLoanApplicationSchema = z.object({
  loanProductId: z.string().min(1, "Loan product is required"),
  memberId: z.string().min(1, "Member ID is required"),
  amountApplied: z.number().positive("Amount must be positive"),
  purpose: z.string().optional(),
  employer: z.string().optional(),
  employmentStatus: z.string().optional(),
  grossMonthlyIncome: z.number().optional(),
  netMonthlyIncome: z.number().optional(),
  repaymentPeriodMonths: z.number().optional(),
  repaymentStartDate: z.string().optional(), // Date string
  interestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).optional(),
  interestPeriod: z.enum(["MONTHLY", "ANNUAL"]).optional(),
  modeOfRepayment: z.string().optional(),
  collateralOffered: z.string().optional(),
  guarantors: z.array(z.any()).optional(),
  applyLoanProcessingFee: z.boolean().optional(),
  loanProcessingFeePercentage: z.number().optional(),
  applyLoanInsurance: z.boolean().optional(),
  loanInsurancePercentage: z.number().optional(),
  applyShareDeduction: z.boolean().optional(),
  shareAmount: z.number().optional(),
  applyLoanApplicationFee: z.boolean().optional(),
  loanApplicationFeePercentage: z.number().optional(),
  applyLoanStationeryFee: z.boolean().optional(),
  loanStationeryFeeAmount: z.number().optional(),
  applyLoanCommitmentFee: z.boolean().optional(),
  loanCommitmentFeePercentage: z.number().optional(),
  collateralType: z.string().optional(),
  collateralValue: z.number().optional(),
  forcedSaleValue: z.number().optional(),
  collateralLocation: z.string().optional(),
  collateralDetails: z.string().optional(),
  hasOtherLoansWithInstitutions: z.boolean().optional(),
  otherLoanInstitutionName: z.string().optional(),
  otherLoanBalance: z.number().optional(),
  otherLoanMonthlyInstallment: z.number().optional(),
  otherMonthlyObligations: z.string().optional(),
  bankName: z.string().optional(),
  bankBranch: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  mobileMoneyNumber: z.string().optional(),
  applicantDeclaration: z.boolean().optional(),
  applicantSignature: z.string().optional(),
  applicantSignatureDate: z.string().optional(),
  guarantorAgreementAccepted: z.boolean().optional(),
  guarantorSignatureDate: z.string().optional(),
  debtToIncomeRatio: z.number().optional(),
  loanOfficerId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");
    const memberId = searchParams.get("memberId");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (memberId) {
      where.memberId = memberId;
    }

    if (search) {
      where.OR = [
        { member: { memberNumber: { contains: search, mode: "insensitive" } } },
        { member: { user: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    // Role-based filtering
    const individualWhere: any = { ...where };
    const institutionWhere: any = { ...where };

    if (session.user.role === "MEMBER") {
      const member = await db.member.findUnique({ where: { userId: session.user.id } });
      if (member) {
        individualWhere.memberId = member.id;
        institutionWhere.id = "none";
      } else {
        return NextResponse.json({ data: [], pagination: { total: 0 } });
      }
    } else if (session.user.role === "INSTITUTION") {
      const inst = await db.institution.findUnique({ where: { userId: session.user.id } });
      if (inst) {
        institutionWhere.institutionId = inst.id;
        individualWhere.id = "none";
      } else {
        return NextResponse.json({ data: [], pagination: { total: 0 } });
      }
    } else if (["TELLER", "LOANOFFICER"].includes(session.user.role)) {
      // Branch-wide visibility (matching BRANCHMANAGER/ACCOUNTANT below), with
      // a fallback to "assigned to me" only when the staff member has no
      // branch set — otherwise ANDing a personal-assignment filter with the
      // branch filter hid every application not personally handled by this
      // exact staff member, even other applications within their own branch.
      if (session.user.branchId) {
        individualWhere.member = { user: { branchId: session.user.branchId } };
        institutionWhere.institution = { user: { branchId: session.user.branchId } };
      } else {
        individualWhere.OR = [
          { applicantId: session.user.id },
          { loanOfficerId: session.user.id },
          { allocatedTellerId: session.user.id }
        ];
        institutionWhere.OR = [
          { applicantUserId: session.user.id },
          { loanOfficerId: session.user.id },
          { allocatedTellerId: session.user.id }
        ];
      }
    } else if (["BRANCHMANAGER", "ACCOUNTANT"].includes(session.user.role) && session.user.branchId) {
      individualWhere.member = { user: { branchId: session.user.branchId } };
      institutionWhere.institution = { user: { branchId: session.user.branchId } };
    }

    const [individualApps, institutionalApps, totalIndividual, totalInstitutional] = await Promise.all([
      db.loanApplication.findMany({
        where: individualWhere,
        skip,
        take: limit,
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
          loan: { select: { id: true, outstandingBalance: true } },
        },
        orderBy: { applicationDate: "desc" },
      }),
      (institutionWhere.id === "none") ? Promise.resolve([]) : db.institutionLoanApplication.findMany({
        where: institutionWhere,
        skip,
        take: limit,
        include: {
          loanProduct: true,
          institution: {
            include: { user: { select: { name: true, email: true, phone: true, image: true } } }
          },
          loanOfficer: { select: { id: true, name: true, role: true } },
          allocatedTeller: { select: { id: true, name: true, role: true } },
          institutionLoan: { select: { id: true, outstandingBalance: true } },
        },
        orderBy: { applicationDate: "desc" },
      }),
      db.loanApplication.count({ where: individualWhere }),
      (institutionWhere.id === "none") ? Promise.resolve(0) : db.institutionLoanApplication.count({ where: institutionWhere }),
    ]);

    const formattedIndividual = individualApps.map((app: any) => ({
      ...app,
      isInstitution: false,
      member: {
        ...app.member,
        account: app.member.accounts?.[0] || null,
      },
    }));

    const formattedInstitutional = (institutionalApps || []).map((app: any) => ({
      ...app,
      isInstitution: true,
      applicationType: "INSTITUTION",
      organizationName: app.institution?.institutionName || "Unknown Institution",
      organizationType: app.institution?.institutionType || "N/A",
      district: app.institution?.district || "N/A",
      mobileNumber: app.institution?.institutionPhone || "N/A",
      emailAddress: app.institution?.institutionEmail || "",
      member: {
        user: {
          id: app.institution?.userId || "N/A",
          name: app.institution?.institutionName || "Unknown Institution",
          email: app.institution?.institutionEmail || "",
          phone: app.institution?.institutionPhone || "",
          image: null
        },
        memberNumber: app.institution?.institutionNumber || "N/A",
        account: null 
      },
      loan: app.institutionLoan || null
    }));

    const allApplications = [...formattedIndividual, ...formattedInstitutional].sort((a: any, b: any) => 
      new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime()
    ).slice(0, limit);

    return NextResponse.json({
      data: allApplications,
      pagination: {
        page,
        limit,
        total: totalIndividual + totalInstitutional,
        totalPages: Math.ceil((totalIndividual + totalInstitutional) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch loan applications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const validation = createLoanApplicationSchema.safeParse(body);

    if (!validation.success) {
      console.error("[API] Validation failed:", validation.error.errors);
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Validate member exists and is approved
    const member = await db.member.findUnique({
      where: { id: data.memberId },
      include: {
        user: true,
        accounts: {
          where: { status: "ACTIVE" },
          include: {
            accountType: true,
          },
        },
        loans: {
          where: {
            status: {
              in: ["DISBURSED", "OVERDUE"],
            },
          },
        },
      },
    });

    if (!member) {
      console.error(`[API] Member not found: ${data.memberId}`);
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (!member.isApproved) {
      console.error(`[API] Member not approved: ${data.memberId}`);
      return NextResponse.json(
        { error: "Member account is not approved/active" },
        { status: 403 }
      );
    }

    if (member.accounts.length === 0) {
      return NextResponse.json(
        { error: "Member must have at least one active account to apply for a loan" },
        { status: 400 }
      );
    }

    // Check for shares account - Allow share deduction to add to existing shares
    // (Removed blocking check - members can now add to existing shares)

    // Check loan eligibility
    const activeLoansCount = member.loans.length;
    const hasOverdueLoans = member.loans.some(
      (loan) => loan.status === "OVERDUE"
    );

    if (hasOverdueLoans) {
      return NextResponse.json(
        { error: "Member has overdue loans that must be cleared first" },
        { status: 400 }
      );
    }

    if (activeLoansCount >= 3) {
      return NextResponse.json(
        { error: "Member has reached maximum limit of active loans (3)" },
        { status: 400 }
      );
    }

    // Validate loan product
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: data.loanProductId },
    });

    if (!loanProduct || !loanProduct.isActive) {
      return NextResponse.json(
        { error: "Loan product not found or not available" },
        { status: 404 }
      );
    }

    // Validate amount is within loan product limits
    if (
      data.amountApplied < loanProduct.minAmount ||
      data.amountApplied > loanProduct.maxAmount
    ) {
      return NextResponse.json(
        { error: `Loan amount must be between ${new Intl.NumberFormat().format(loanProduct.minAmount)} and ${new Intl.NumberFormat().format(loanProduct.maxAmount)}` },
        { status: 400 }
      );
    }

    // Calculate total outstanding balance (for existing loans)
    const totalOutstandingBalance = member.loans.reduce(
      (sum, loan) => sum + (loan.outstandingBalance || 0),
      0
    );

    const insuranceAmount =
      data.applyLoanInsurance && data.loanInsurancePercentage
        ? (data.amountApplied * data.loanInsurancePercentage) / 100
        : 0;
    const processingFeeAmount =
      data.applyLoanProcessingFee
        ? (data.amountApplied * (data.loanProcessingFeePercentage || 1)) / 100
        : 0;

    let resolvedLoanOfficerId: string | null = null;
    if (data.loanOfficerId) {
      const officer = await db.user.findUnique({
        where: { id: data.loanOfficerId },
        select: { id: true },
      });
      resolvedLoanOfficerId = officer?.id ?? null;
    }

    const loanApplication = await db.$transaction(async (tx) => {
      const feeBranchId = member.user.branchId || session.user.branchId || null;
      const createdApplication = await tx.loanApplication.create({
        data: {
          loanProductId: data.loanProductId,
          memberId: data.memberId,
          amountApplied: data.amountApplied,
          purpose: data.purpose?.trim() || null,
          status: "PENDING",
          stage: "SUBMITTED",
          applicantId: member.userId || null,
          loanOfficerId: resolvedLoanOfficerId,
          employer: data.employer?.trim() || null,
          employmentStatus: data.employmentStatus?.trim() || null,
          grossMonthlyIncome: data.grossMonthlyIncome || null,
          netMonthlyIncome: data.netMonthlyIncome || null,
          repaymentPeriodMonths: data.repaymentPeriodMonths || null,
          repaymentStartDate: data.repaymentStartDate
            ? new Date(data.repaymentStartDate)
            : null,
          interestType: data.interestType || null,
          interestPeriod: data.interestPeriod || loanProduct.interestPeriod,
          modeOfRepayment: data.modeOfRepayment?.trim() || null,
          collateralOffered: data.collateralOffered?.trim() || null,
          guarantors: data.guarantors
            ? (data.guarantors.filter((g: any) => g?.fullName?.trim()) as any)
            : null,
          applyLoanProcessingFee: data.applyLoanProcessingFee || false,
          loanProcessingFeePercentage: data.applyLoanProcessingFee
            ? data.loanProcessingFeePercentage || 1
            : null,
          applyLoanInsurance: data.applyLoanInsurance || false,
          loanInsurancePercentage: data.applyLoanInsurance
            ? data.loanInsurancePercentage || 1.5
            : null,
          applyShareDeduction: data.applyShareDeduction || false,
          shareAmount: data.applyShareDeduction
            ? data.shareAmount || 20000
            : null,
          applyLoanApplicationFee: data.applyLoanApplicationFee || false,
          loanApplicationFeePercentage: data.applyLoanApplicationFee
            ? data.loanApplicationFeePercentage || 1
            : null,
          applyLoanStationeryFee: data.applyLoanStationeryFee || false,
          loanStationeryFeeAmount: data.applyLoanStationeryFee
            ? data.loanStationeryFeeAmount || 10000
            : null,
          applyLoanCommitmentFee: data.applyLoanCommitmentFee || false,
          loanCommitmentFeePercentage: data.applyLoanCommitmentFee
            ? data.loanCommitmentFeePercentage || 0.5
            : null,
          collateralType: data.collateralType || null,
          collateralValue: data.collateralValue || null,
          forcedSaleValue: data.forcedSaleValue || null,
          collateralLocation: data.collateralLocation?.trim() || null,
          collateralDetails: data.collateralDetails?.trim() || null,
          hasExistingLoanWithSacco: totalOutstandingBalance > 0,
          existingLoanBalance:
            totalOutstandingBalance > 0 ? totalOutstandingBalance : null,
          hasOtherLoansWithInstitutions:
            data.hasOtherLoansWithInstitutions || false,
          otherLoanInstitutionName: data.otherLoanInstitutionName?.trim() || null,
          otherLoanBalance: data.otherLoanBalance || null,
          otherLoanMonthlyInstallment: data.otherLoanMonthlyInstallment || null,
          otherMonthlyObligations: data.otherMonthlyObligations?.trim() || null,
          bankName: data.bankName?.trim() || null,
          bankBranch: data.bankBranch?.trim() || null,
          bankAccountNumber: data.bankAccountNumber?.trim() || null,
          mobileMoneyNumber: data.mobileMoneyNumber?.trim() || null,
          applicantDeclaration: data.applicantDeclaration,
          applicantSignature: data.applicantSignature?.trim() || null,
          applicantSignatureDate: data.applicantSignatureDate ? new Date(data.applicantSignatureDate) : new Date(),
          guarantorAgreementAccepted: data.guarantorAgreementAccepted,
          guarantorSignatureDate: data.guarantorSignatureDate ? new Date(data.guarantorSignatureDate) : new Date(),
          debtToIncomeRatio: data.debtToIncomeRatio || null,
        },
        include: {
          loanProduct: true,
          member: {
            include: {
              user: true,
            },
          },
        },
      });

      if (processingFeeAmount > 0) {
        const feeCategory = await tx.budgetCategory.upsert({
          where: { code: LOAN_PROCESSING_FEES_CODE },
          update: {
            name: "Loan processing fees",
          },
          create: {
            name: "Loan processing fees",
            code: LOAN_PROCESSING_FEES_CODE,
            kind: "INCOME",
            description: "Fees collected for loan processing",
            isActive: true,
          },
        });

        await tx.incomeRecord.create({
          data: {
            budgetCategoryId: feeCategory.id,
            amount: processingFeeAmount,
            date: new Date(),
            recordDate: new Date(),
            description: `Loan Processing Fee - ${member.user.name} - ${createdApplication.id.slice(0, 8)}`,
            receivedByUserId: session.user.id,
            branchId: feeBranchId,
            memberId: data.memberId,
            depositorName: member.user.name,
            status: "COMPLETED",
            paymentMethod: "CASH",
            referenceNumber: `LPF-APP-${createdApplication.id.slice(0, 8)}`,
            notes: "Automated entry from loan application fee collection.",
          },
        });

        // Create Transaction record so fee appears in transaction-based reports
        const memberAccountId = member.accounts[0]?.id;
        if (memberAccountId) {
          await tx.transaction.create({
            data: {
              transactionRef: `LPF-APP-${createdApplication.id.slice(0, 8)}`,
              memberId: data.memberId,
              accountId: memberAccountId,
              type: "FEE",
              amount: processingFeeAmount,
              fee: processingFeeAmount,
              currency: "UGX",
              status: "COMPLETED",
              description: `Loan Processing Fee - ${member.user.name}`,
              channel: "CASH",
              processedByUserId: session.user.id,
              branchId: feeBranchId,
            },
          });
        }

        // Update teller drawer balance for cash collected
        await tx.userFloat.upsert({
          where: { userId: session.user.id },
          update: { balance: { increment: processingFeeAmount } },
          create: {
            userId: session.user.id,
            balance: processingFeeAmount,
          },
        });

        // Ensure both COA accounts exist before looking them up inside the transaction.
        // These helpers use the regular `db` client (not `tx`) so they commit
        // immediately and are visible to subsequent tx.findFirst() calls.
        const { ensureIncomeStructure } = await import("@/lib/services/income-structure");
        const { ensureAssetStructure } = await import("@/lib/services/asset-structure");
        await Promise.all([ensureIncomeStructure(), ensureAssetStructure()]);

        const feeGl = await findActiveAccountByCodes(tx, [LOAN_PROCESSING_FEES_CODE]);
        const feeCashGl = await findActiveAccountByCodes(tx, [CASH_AT_HAND_CODE]);

        if (feeGl && feeCashGl) {
          const jeNum = `JE-LPF-APP-${Date.now()}`;
          await tx.journalEntry.create({
            data: {
              entryNumber: jeNum,
              accountId: feeCashGl.id,
              debitAmount: processingFeeAmount,
              creditAmount: 0,
              description: `Loan processing fee - ${createdApplication.id.slice(0, 8)}`,
              entryDate: new Date(),
              reference: `LPF-APP-${createdApplication.id.slice(0, 8)}`,
              branchId: feeBranchId,
              createdByUserId: session.user.id,
            },
          });
          await tx.journalEntry.create({
            data: {
              entryNumber: jeNum,
              accountId: feeGl.id,
              debitAmount: 0,
              creditAmount: processingFeeAmount,
              description: `Loan processing fee - ${createdApplication.id.slice(0, 8)}`,
              entryDate: new Date(),
              reference: `LPF-APP-${createdApplication.id.slice(0, 8)}`,
              branchId: feeBranchId,
              createdByUserId: session.user.id,
            },
          });
          await tx.chartOfAccount.update({
            where: { id: feeCashGl.id },
            data: { debitBalance: { increment: processingFeeAmount }, balance: { increment: processingFeeAmount } } as any,
          });
          await tx.chartOfAccount.update({
            where: { id: feeGl.id },
            data: { creditBalance: { increment: processingFeeAmount }, balance: { increment: processingFeeAmount } } as any,
          });
        }
      }

      if (insuranceAmount > 0) {
        const shortId = createdApplication.id.slice(0, 8);
        await recordLoanInsuranceCollection({
          tx,
          amount: insuranceAmount,
          createdById: session.user.id,
          branchId: member.user.branchId || null,
          memberId: data.memberId,
          loanApplicationId: createdApplication.id,
          description: `Insurance from loan application - ${member.user.name} - ${shortId}`,
          reference: `INS-APP-${shortId}`,
          entryDescription: `Loan insurance collected on application - ${member.user.name}`,
          createJournalEntry: true,
          debitAccountCode: CASH_AT_HAND_CODE,
          operationalTransaction: {
            transactionRef: `INS-APP-${Date.now()}`,
            memberId: data.memberId,
            description: `Loan insurance premium collected at application - ${member.user.name}`,
            processedByUserId: session.user.id,
          },
        });
      }

      return createdApplication;
    });


    // Send notifications
    try {
      const formattedAmount = new Intl.NumberFormat("en-UG", {
        style: "currency",
        currency: "UGX",
        minimumFractionDigits: 0,
      }).format(data.amountApplied);

      // Notify member
      await db.notification.create({
        data: {
          userId: member.user.id,
          type: NotificationType.IN_APP,
          subject: "Loan Application Submitted Successfully",
          message: `Your loan application for ${formattedAmount} (${loanProduct.name}) has been submitted and is under review.`,
          targetAddress: `/dashboard/my-loans`,
          sentAt: new Date(),
          isRead: false,
          status: "SENT",
        },
      });

      // Notify approvers
      const approvers = await db.user.findMany({
        where: {
          OR: [
            { role: "BRANCHMANAGER" },
            { role: "ADMIN" },
          ],
          isActive: true,
        },
        select: { id: true },
      });

      for (const approver of approvers) {
        await db.notification.create({
          data: {
            userId: approver.id,
            type: NotificationType.IN_APP,
            subject: "New Loan Application Pending Review",
            message: `${member.user.name} has applied for a ${loanProduct.name} loan of ${formattedAmount}.`,
            targetAddress: `/dashboard/loans/manager-loan-process-tracking?highlight=${loanApplication.id}`,
            sentAt: new Date(),
            isRead: false,
            status: "SENT",
          },
        });
      }

      // Send email notification to member
      if (member.user.email) {
        await sendLoanApplicationEmail(
          member.user.email,
          member.user.name,
          loanProduct.name,
          data.amountApplied
        );
      }
    } catch (notifyError) {
      console.error("[API] Error sending notifications:", notifyError);
    }

    return NextResponse.json(loanApplication, { status: 201 });
  } catch (error: any) {
    console.error("[API] Error creating loan application:", error);
    
    // Detailed Prisma error handling
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "A loan application with similar unique constraints already exists." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create loan application", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
      },
      { status: 500 }
    );
  }
}
