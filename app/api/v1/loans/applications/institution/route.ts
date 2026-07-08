import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanStatus, LoanStage, UserRole } from "@prisma/client";
import { sendLoanApplicationEmail } from "@/lib/email";
import { 
  notifyBranchManagersAboutInstitutionLoan 
} from "@/actions/notification";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { 
      institutionId, 
      loanProductId, 
      amountApplied, 
      purpose, 
      repaymentPeriodMonths,
      collateralOffered 
    } = body;

    // Validate required fields
    if (!institutionId || !loanProductId || !amountApplied || !purpose) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify institution exists
    const institution = await db.institution.findUnique({
      where: { id: institutionId },
      include: {
        user: true,
        accounts: {
          where: { status: "ACTIVE" },
          include: { branch: true },
          take: 1,
        },
      },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    // Verify loan product exists
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: loanProductId },
    });

    if (!loanProduct || !loanProduct.isActive) {
      return NextResponse.json({ error: "Loan product not found or inactive" }, { status: 404 });
    }

    // Validate loan amount is within product limits
    if (amountApplied < loanProduct.minAmount || amountApplied > loanProduct.maxAmount) {
      return NextResponse.json({ 
        error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}` 
      }, { status: 400 });
    }

    // Check for existing pending applications (Removed restriction to allow multiple applications as requested)
    /*
    const existingApplication = await db.institutionLoanApplication.findFirst({
      where: {
        institutionId,
        status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
      },
    });

    if (existingApplication) {
      return NextResponse.json({ 
        error: "This institution already has a pending or active loan application" 
      }, { status: 400 });
    }
    */

    // Create institutional loan application
    const loanApplication = await db.institutionLoanApplication.create({
      data: {
        loanProductId,
        institutionId,
        amountApplied: Number(amountApplied),
        purpose,
        collateralOffered: collateralOffered || null,
        repaymentPeriodMonths: repaymentPeriodMonths ? Number(repaymentPeriodMonths) : null,
        status: LoanStatus.PENDING,
        stage: LoanStage.SUBMITTED,
      },
      include: {
        institution: { include: { user: true } },
        loanProduct: true,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INSTITUTION_LOAN_APPLICATION_CREATED",
        entityType: "InstitutionLoanApplication",
        entityId: loanApplication.id,
        newValue: {
          institutionId,
          loanProductId,
          amountApplied,
          status: LoanStatus.PENDING,
        },
        details: `Created institution loan application via API for ${institution.institutionName}`,
      },
    });

    // Send notifications to branch managers and admin
    const branchId = institution.accounts[0]?.branch?.id;
    await notifyBranchManagersAboutInstitutionLoan(
      loanApplication.id,
      institution.institutionName,
      amountApplied,
      loanProduct.name,
      branchId
    );

    // Send email notification to institution
    const institutionEmail = institution.institutionEmail || institution.user.email;
    if (institutionEmail) {
      await sendLoanApplicationEmail(
        institutionEmail,
        institution.institutionName,
        loanProduct.name,
        amountApplied
      );
    }

    return NextResponse.json(loanApplication, { status: 201 });
  } catch (error: any) {
    console.error("[API] Error creating institutional loan application:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const institutionId = searchParams.get("institutionId");

    const where: any = {};
    if (institutionId) {
      where.institutionId = institutionId;
    }

    // Role-based filtering
    if (session.user.role === "INSTITUTION") {
      const institution = await db.institution.findUnique({
        where: { userId: session.user.id },
      });
      if (institution) {
        where.institutionId = institution.id;
      } else {
        return NextResponse.json({ data: [] });
      }
    }

    const applications = await db.institutionLoanApplication.findMany({
      where,
      include: {
        institution: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
        loanProduct: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: applications });
  } catch (error) {
    console.error("[API] Error fetching institutional loan applications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
