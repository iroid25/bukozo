// actions/institutionLoanApplications.ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { LoanStatus, LoanStage, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import {
  notifyBranchManagersAboutInstitutionLoan,
  notifyInstitutionOfLoanDecision,
  notifyInstitutionOfLoanDisbursement,
} from "./notification";
import { sendLoanApplicationEmail, sendLoanApprovalEmail, sendTransactionAlertEmail } from "@/lib/email";

// =====================
// Types/DTOs
// =====================

export interface InstitutionLoanApplicationCreateDTO {
  institutionId: string;
  loanProductId: string;
  amountApplied: number;
  purpose: string;
  repaymentPeriodMonths?: number | string;
  collateralOffered?: string;
  
  // New fields from schema
  guarantors?: any;
  administrators?: any;
  operatingInstructions?: string;
  changeOfSignatoryInstructions?: string;
  accountTitle?: string;
  accountType?: string;
  hasRegistrationCertificate?: boolean;
  hasLCRecommendation?: boolean;
  hasVicarRecommendation?: boolean;
  hasMinutes?: boolean;
  hasByeLaws?: boolean;
  hasDissolutionResolution?: boolean;
  annualRevenue?: number;
  monthlyRevenue?: number;
  annualExpenses?: number;
  monthlyExpenses?: number;
  netMonthlyIncome?: number;
  earnings?: string;
  earningsType?: string;
  hasExistingLoansWithSacco?: boolean;
  hasLoansWithOtherInstitutions?: boolean;
  otherMonthlyObligations?: string;
  applyLoanProcessingFee?: boolean;
  loanProcessingFeePercentage?: number;
  applyLoanInsurance?: boolean;
  loanInsurancePercentage?: number;
  applyShareDeduction?: boolean;
  shareAmount?: number;
  bankName?: string;
  bankBranch?: string;
  bankAccountNumber?: string;
  mobileMoneyNumber?: string;
  applicantDeclaration?: boolean;
  applicantSignature?: string;
  guarantorAgreementAccepted?: boolean;
  gracePeriod?: number;
  interestType?: any;
  interestPeriod?: any;
}

export interface InstitutionLoanApplicationUpdateDTO {
  id: string;
  amountApplied?: number;
  purpose?: string;
  loanProductId?: string;
  repaymentPeriodMonths?: number;
  collateralOffered?: string;
}

export interface InstitutionLoanApplicationDecisionDTO {
  id: string;
  status: LoanStatus;
  approvedAmount?: number;
  rejectionReason?: string;
  allocatedTellerId?: string;
  disbursementMethod?: string;
}

// =====================
// Fetch Functions
// =====================

// Fetch all institution loan applications with relations
export async function getAllInstitutionLoanApplications() {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: [],
      };
    }

    const applications = await db.institutionLoanApplication.findMany({
      include: {
        institution: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        loanProduct: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      error: null,
      data: applications,
    };
  } catch (error) {
    console.error("Error fetching institution loan applications:", error);
    return {
      error: "Failed to fetch loan applications",
      data: [],
    };
  }
}

// Fetch single institution loan application by ID
export async function getInstitutionLoanApplicationById(id: string) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    const loanApplication = await db.institutionLoanApplication.findUnique({
      where: { id },
      include: {
        institution: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        loanProduct: true,
        institutionLoan: {
          include: {
            repayments: {
              orderBy: {
                repaymentDate: "desc",
              },
            },
          },
        },
      },
    });

    if (!loanApplication) {
      return {
        error: "Loan application not found",
        data: null,
      };
    }

    return {
      error: null,
      data: loanApplication,
    };
  } catch (error) {
    console.error("Error fetching institution loan application:", error);
    return {
      error: "Failed to fetch loan application",
      data: null,
    };
  }
}

// Fetch loan applications by institution ID
export async function getInstitutionLoanApplicationsByInstitutionId(
  institutionId: string
) {
  try {
    const loanApplications = await db.institutionLoanApplication.findMany({
      where: { institutionId },
      include: {
        loanProduct: true,
        institutionLoan: {
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
      orderBy: {
        applicationDate: "desc",
      },
    });
    return loanApplications;
  } catch (error) {
    console.error("Error fetching institution loan applications:", error);
    return [];
  }
}

// Update institution loan application status
export async function updateInstitutionLoanApplicationStatus(
  id: string,
  status: LoanStatus
) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.LOANOFFICER,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return {
        error: "You don't have permission to update loan applications",
        data: null,
      };
    }

    const application = await db.institutionLoanApplication.update({
      where: { id },
      data: { status },
      include: {
        institution: {
          include: {
            user: true,
          },
        },
        loanProduct: true,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_LOAN_APPLICATION_STATUS_UPDATED",
        entityType: "InstitutionLoanApplication",
        entityId: id,
        newValue: { status },
        details: `Updated loan application status to ${status}`,
      },
    });

    revalidatePath("/dashboard/institution-loan-applications");
    revalidatePath(`/dashboard/institution-loan-applications/${id}`);

    return {
      error: null,
      data: application,
    };
  } catch (error) {
    console.error("Error updating institution loan application:", error);
    return {
      error: "Failed to update loan application",
      data: null,
    };
  }
}

// =====================
// Create Function
// =====================

// Create new institution loan application
// UPDATED: createInstitutionLoanApplication function
// Add this import at the top of your institutionLoanApplications.ts file:

// Replace your existing createInstitutionLoanApplication with this:
export async function createInstitutionLoanApplication(
  data: InstitutionLoanApplicationCreateDTO,
  loanOfficerUserId: string
) {
  console.log("🎯 INSTITUTION LOAN ACTION CALLED!");
  console.log("📦 Data received:", data);
  console.log("👤 User ID:", loanOfficerUserId);

  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return {
        error: "Unauthorized. Please login.",
        data: null,
      };
    }

    // Validate required fields
    if (
      !data.institutionId ||
      !data.loanProductId ||
      !data.amountApplied ||
      !data.purpose
    ) {
      return {
        error: "Missing required fields",
        data: null,
      };
    }

    // Verify institution exists
    const institution = await db.institution.findUnique({
      where: { id: data.institutionId },
      include: {
        user: true,
        accounts: {
          where: { status: "ACTIVE" },
          include: {
            branch: true,
          },
          take: 1,
        },
      },
    });

    if (!institution) {
      return {
        error: "Institution not found",
        data: null,
      };
    }

    console.log("🏢 Institution found:", institution.institutionName);

    // Verify loan product exists
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: data.loanProductId },
    });

    if (!loanProduct) {
      return {
        error: "Loan product not found",
        data: null,
      };
    }

    console.log("💰 Loan product found:", loanProduct.name);

    // Validate loan amount is within product limits
    if (
      data.amountApplied < loanProduct.minAmount ||
      data.amountApplied > loanProduct.maxAmount
    ) {
      return {
        error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}`,
        data: null,
      };
    }

    // Check for existing pending applications
    const existingApplication = await db.institutionLoanApplication.findFirst({
      where: {
        institutionId: data.institutionId,
        status: {
          in: ["PENDING", "UNDER_REVIEW", "APPROVED"],
        },
      },
    });

    if (existingApplication) {
      return {
        error:
          "This institution already has a pending or active loan application",
        data: null,
      };
    }

    console.log("📋 Existing applications: 0");

    // Convert repaymentPeriodMonths to number if it's a string
    let repaymentPeriod: number | undefined = undefined;

    if (
      data.repaymentPeriodMonths !== undefined &&
      data.repaymentPeriodMonths !== null &&
      data.repaymentPeriodMonths !== ""
    ) {
      if (typeof data.repaymentPeriodMonths === "string") {
        const parsed = parseInt(data.repaymentPeriodMonths, 10);
        repaymentPeriod = isNaN(parsed) ? undefined : parsed;
      } else {
        repaymentPeriod = data.repaymentPeriodMonths;
      }
    }

    console.log("✅ Creating loan application...");
    console.log(
      "📊 Converted repaymentPeriodMonths:",
      repaymentPeriod,
      "Type:",
      typeof repaymentPeriod
    );

    // Build the data object comprehensively
    const createData: any = {
      loanProductId: data.loanProductId,
      institutionId: data.institutionId,
      amountApplied: Number(data.amountApplied),
      purpose: data.purpose,
      collateralOffered: data.collateralOffered || null,
      status: LoanStatus.PENDING,
      stage: LoanStage.SUBMITTED,
      
      // Map all new fields
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
      earnings: data.earnings || null,
      earningsType: data.earningsType || null,
      hasExistingLoansWithSacco: data.hasExistingLoansWithSacco || false,
      hasLoansWithOtherInstitutions: data.hasLoansWithOtherInstitutions || false,
      otherMonthlyObligations: data.otherMonthlyObligations || null,
      applyLoanProcessingFee: data.applyLoanProcessingFee || false,
      loanProcessingFeePercentage: data.loanProcessingFeePercentage || null,
      applyLoanInsurance: data.applyLoanInsurance || false,
      loanInsurancePercentage: data.loanInsurancePercentage || null,
      applyShareDeduction: data.applyShareDeduction || false,
      shareAmount: data.shareAmount || null,
      bankName: data.bankName || null,
      bankBranch: data.bankBranch || null,
      bankAccountNumber: data.bankAccountNumber || null,
      mobileMoneyNumber: data.mobileMoneyNumber || null,
      applicantDeclaration: data.applicantDeclaration || false,
      applicantSignature: data.applicantSignature || null,
      guarantorAgreementAccepted: data.guarantorAgreementAccepted || false,
      gracePeriod: data.gracePeriod || 0,
      interestType: data.interestType || loanProduct.interestType,
      interestPeriod: data.interestPeriod || loanProduct.interestPeriod,
      applicantUserId: loanOfficerUserId,
      loanOfficerId: loanOfficerUserId, // Initially assign to the creating officer
    };

    // Only add repaymentPeriodMonths if it has a valid value
    if (repaymentPeriod !== undefined) {
      createData.repaymentPeriodMonths = repaymentPeriod;
    }

    // Create institution loan application
    const loanApplication = await db.institutionLoanApplication.create({
      data: createData,
      include: {
        institution: {
          include: {
            user: true,
          },
        },
        loanProduct: true,
      },
    });

    console.log(
      "✅ Loan application created successfully:",
      loanApplication.id
    );

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "INSTITUTION_LOAN_APPLICATION_CREATED",
        entityType: "InstitutionLoanApplication",
        entityId: loanApplication.id,
        newValue: {
          institutionId: data.institutionId,
          loanProductId: data.loanProductId,
          amountApplied: data.amountApplied,
          status: LoanStatus.PENDING,
        },
        details: `Created institution loan application for ${institution.institutionName}`,
      },
    });

    console.log("📝 Audit log created");

    // ✅ NEW: Send notifications to branch managers and admin
    const branchId = institution.accounts[0]?.branch?.id;
    const notificationResult = await notifyBranchManagersAboutInstitutionLoan(
      loanApplication.id,
      institution.institutionName,
      data.amountApplied,
      loanProduct.name,
      branchId
    );

    if (notificationResult.ok) {
      console.log("📧 Notifications sent to branch managers and admin");
    } else {
      console.warn(
        "⚠️ Failed to send notifications:",
        notificationResult.error
      );
      // Don't fail the entire operation if notifications fail
    }

    // Send email notification to institution
    const institutionEmail = institution.institutionEmail || institution.user.email;
    if (institutionEmail) {
      await sendLoanApplicationEmail(
        institutionEmail,
        institution.institutionName,
        loanProduct.name,
        data.amountApplied
      );
    }

    // Revalidate relevant paths
    revalidatePath("/dashboard/loan-applications");
    revalidatePath("/dashboard/institution-loan-applications");
    revalidatePath("/dashboard"); // For notification dropdown

    return {
      error: null,
      data: loanApplication,
    };
  } catch (error) {
    console.error("❌ Error creating institution loan application:", error);
    return {
      error: "Failed to create loan application. Please try again.",
      data: null,
    };
  }
}
// =====================
// Update Function
// =====================

// Update institution loan application (only if PENDING)
export async function updateInstitutionLoanApplication(
  data: InstitutionLoanApplicationUpdateDTO
) {
  try {
    // Check if application exists and is pending
    const existingApplication = await db.institutionLoanApplication.findUnique({
      where: { id: data.id },
    });

    if (!existingApplication) {
      return {
        error: "Institution loan application not found",
        data: null,
      };
    }

    if (existingApplication.status !== LoanStatus.PENDING) {
      return {
        error: "Can only update pending loan applications",
        data: null,
      };
    }

    const updateData: any = {};

    if (data.purpose !== undefined) {
      updateData.purpose = data.purpose?.trim() || null;
    }

    if (data.collateralOffered !== undefined) {
      updateData.collateralOffered = data.collateralOffered?.trim() || null;
    }

    if (data.repaymentPeriodMonths !== undefined) {
      updateData.repaymentPeriodMonths = data.repaymentPeriodMonths;
    }

    if (data.amountApplied !== undefined) {
      const loanProduct = await db.loanProduct.findUnique({
        where: { id: existingApplication.loanProductId },
      });

      if (!loanProduct) {
        return {
          error: "Loan product not found",
          data: null,
        };
      }

      if (
        data.amountApplied < loanProduct.minAmount ||
        data.amountApplied > loanProduct.maxAmount
      ) {
        return {
          error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}`,
          data: null,
        };
      }
      updateData.amountApplied = data.amountApplied;
    }

    if (data.loanProductId !== undefined) {
      const newLoanProduct = await db.loanProduct.findUnique({
        where: { id: data.loanProductId },
      });

      if (!newLoanProduct || !newLoanProduct.isActive) {
        return {
          error: "Selected loan product is not available",
          data: null,
        };
      }

      updateData.loanProductId = data.loanProductId;
    }

    const updatedApplication = await db.institutionLoanApplication.update({
      where: { id: data.id },
      data: updateData,
      include: {
        institution: {
          include: {
            user: true,
          },
        },
        loanProduct: true,
      },
    });

    revalidatePath("/dashboard/institution-loan-applications");
    revalidatePath(`/dashboard/institution-loan-applications/${data.id}`);
    return {
      error: null,
      data: updatedApplication,
    };
  } catch (error) {
    console.error("Error updating institution loan application:", error);
    return {
      error: "Failed to update institution loan application. Please try again.",
      data: null,
    };
  }
}

// =====================
// Decision Function (Branch Manager Approval)
// =====================

// Approve or reject institution loan application
export async function decideInstitutionLoanApplication(
  data: InstitutionLoanApplicationDecisionDTO,
  branchManagerId: string
) {
  try {
    const application = await db.institutionLoanApplication.findUnique({
      where: { id: data.id },
      include: {
        institution: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              orderBy: { openedAt: "asc" },
              take: 1,
            },
          },
        },
        loanProduct: true,
      },
    });

    if (!application) {
      return { error: "Institution loan application not found", data: null };
    }

    if (application.status !== LoanStatus.PENDING) {
      return {
        error: "Can only decide on pending loan applications",
        data: null,
      };
    }

    if (data.status === LoanStatus.REJECTED && !data.rejectionReason?.trim()) {
      return {
        error: "Rejection reason is required for rejected applications",
        data: null,
      };
    }

    const result = await db.$transaction(async (tx: any) => {
      // 1) Mark decision
      const updatedApplication = await tx.institutionLoanApplication.update({
        where: { id: data.id },
        data: {
          status: data.status,
          approvalDate: new Date(),
          rejectionReason:
            data.status === LoanStatus.REJECTED
              ? data.rejectionReason?.trim()
              : null,
          stage:
            data.status === LoanStatus.APPROVED
              ? LoanStage.APPROVED
              : LoanStage.REJECTED,
          allocatedTellerId: data.allocatedTellerId || null,
          approvedAmount: data.status === LoanStatus.APPROVED ? (data.approvedAmount || application.amountApplied) : null,
        },
      });

      // 2) If approved → create loan record in APPROVED status (awaiting disbursement)
      if (data.status === LoanStatus.APPROVED) {
        const amountGranted = data.approvedAmount || application.amountApplied;
        
        // Check for existing active institution loans
        const existingActiveLoans = await tx.institutionLoan.findMany({
          where: {
            institutionId: application.institutionId,
            status: { in: [LoanStatus.DISBURSED, "OVERDUE" as any] },
          },
        });
        
        if (existingActiveLoans.length > 0) {
          const totalOutstanding = existingActiveLoans.reduce(
            (sum: number, l: any) => sum + (l.outstandingBalance || 0), 0
          );
          
          // Block approval if deductions would exceed the new loan amount
          if (totalOutstanding >= amountGranted) {
            throw new Error(
              `Cannot approve loan: Institution has ${existingActiveLoans.length} active loan(s) with total outstanding balance of UGX ${totalOutstanding.toLocaleString()}, which exceeds or equals the approved amount of UGX ${amountGranted.toLocaleString()}. The previous loan balance must be less than the new loan amount.`
            );
          }
          
          console.log(
            `⚠️ Institution has ${existingActiveLoans.length} active loan(s) with outstanding balance UGX ${totalOutstanding.toLocaleString()}. This will be auto-deducted during disbursement.`
          );
        }
        const repaymentPeriodMonths = application.repaymentPeriodMonths || 12;
        const interestRate = application.loanProduct.interestRate;

        // Interest calculation (simple interest)
        const annualInterest = (amountGranted * interestRate) / 100;
        const periodInterest = (annualInterest * repaymentPeriodMonths) / 12;
        const totalAmountDue = amountGranted + periodInterest;

        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() + repaymentPeriodMonths);

        // Validate teller if provided
        if (data.allocatedTellerId) {
          const teller = await tx.user.findUnique({
            where: { id: data.allocatedTellerId },
            select: { id: true, role: true },
          });
          if (!teller || teller.role !== UserRole.TELLER) {
            throw new Error("Selected user must have TELLER role.");
          }
        }

        // 2a) Create institution loan record in APPROVED status
        await tx.institutionLoan.create({
          data: {
            applicationId: application.id,
            institutionId: application.institutionId,
            amountGranted,
            interestRate,
            totalAmountDue,
            outstandingBalance: totalAmountDue,
            dueDate,
            status: LoanStatus.APPROVED,
            allocatedTellerId: data.allocatedTellerId || null,
            disbursementDate: null,
          },
        });
      }

      return updatedApplication;
    });

    // ✅ NEW: Send decision notification (approval or rejection)
    const decisionNotificationResult = await notifyInstitutionOfLoanDecision(
      application.institution.userId,
      application.institution.institutionName,
      data.status === LoanStatus.APPROVED,
      application.amountApplied,
      data.approvedAmount,
      data.rejectionReason
    );

    if (decisionNotificationResult.ok) {
      console.log("📧 Decision notification sent to institution");

      // Send Approval Email if approved
      if (data.status === LoanStatus.APPROVED) {
        const institutionEmail = application.institution.institutionEmail || application.institution.user.email;
        if (institutionEmail) {
          await sendLoanApprovalEmail(
            institutionEmail,
            application.institution.institutionName,
            application.loanProduct.name,
            data.approvedAmount || application.amountApplied
          );
        }
      }
    }
 else {
      console.warn("⚠️ Failed to send decision notification");
    }

    revalidatePath("/dashboard/institution-loan-applications");
    revalidatePath(`/dashboard/institution-loan-applications/${data.id}`);
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard"); // For notification dropdown

    return { error: null, data: result };
  } catch (error) {
    console.error("Error deciding institution loan application:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to process loan decision. Please try again.",
      data: null,
    };
  }
}

// =====================
// Statistics Function
// =====================

// Get institution loan application statistics
export async function getInstitutionLoanApplicationStatistics() {
  try {
    const [pending, approved, rejected, disbursed] = await Promise.all([
      db.institutionLoanApplication.count({
        where: { status: LoanStatus.PENDING },
      }),
      db.institutionLoanApplication.count({
        where: { status: LoanStatus.APPROVED },
      }),
      db.institutionLoanApplication.count({
        where: { status: LoanStatus.REJECTED },
      }),
      db.institutionLoanApplication.count({
        where: { status: LoanStatus.DISBURSED },
      }),
    ]);

    const totalAmount = await db.institutionLoanApplication.aggregate({
      where: { status: { in: [LoanStatus.DISBURSED] } },
      _sum: { amountApplied: true },
    });

    return {
      pending,
      approved,
      rejected,
      disbursed,
      totalAmount: totalAmount._sum.amountApplied || 0,
    };
  } catch (error) {
    console.error(
      "Error fetching institution loan application statistics:",
      error
    );
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      disbursed: 0,
      totalAmount: 0,
    };
  }
}

// =====================
// Helper Functions
// =====================

// Get approved institutions for loan application
export async function getInstitutionsForLoanApplication() {
  try {
    const institutions = await db.institution.findMany({
      where: {
        isApproved: true,
        accounts: {
          some: {
            status: "ACTIVE",
          },
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        accounts: {
          where: { status: "ACTIVE" },
          select: {
            balance: true,
          },
        },
      },
      orderBy: {
        institutionNumber: "asc",
      },
    });
    return institutions;
  } catch (error) {
    console.error("Error fetching institutions for loan application:", error);
    return [];
  }
}

// Get tellers for loan allocation
export async function getTellersForAllocation() {
  try {
    const tellers = await db.user.findMany({
      where: {
        role: "TELLER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        branch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    return tellers;
  } catch (error) {
    console.error("Error fetching tellers:", error);
    return [];
  }
}

// Search members for guarantor selection
export async function searchMembersForGuarantor(query: string) {
  try {
    if (!query || query.length < 2) return [];

    const members = await db.member.findMany({
      where: {
        approvalStatus: "APPROVED",
        OR: [
          { memberNumber: { contains: query, mode: "insensitive" } },
          { user: { name: { contains: query, mode: "insensitive" } } },
          { user: { phone: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            branch: { select: { name: true } },
          },
        },
      },
      take: 20,
      orderBy: { user: { name: "asc" } },
    });

    return members.map((m) => ({
      id: m.id,
      memberNumber: m.memberNumber,
      name: m.user.name,
      phone: m.user.phone || "N/A",
      branch: m.user.branch?.name || "N/A",
    }));
  } catch (error) {
    console.error("Error searching members for guarantor:", error);
    return [];
  }
}
