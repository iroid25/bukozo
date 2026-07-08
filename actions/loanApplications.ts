"use server";

import { revalidatePath } from "next/cache";
import {
  LoanApplicationCreateDTO,
  LoanApplicationUpdateDTO,
  LoanApplicationDecisionDTO,
} from "@/types/loanApplication";

import { db } from "@/prisma/db";
import { LoanStatus } from "@/app/(dashboard)/dashboard/loan-products/components/types";
import { NotificationType } from "@prisma/client";
import { LoanService } from "@/services/loan.service";
import { sendLoanApplicationEmail, sendLoanApprovalEmail, sendTransactionAlertEmail } from "@/lib/email";

// =============================================
// HELPER FUNCTIONS FOR NOTIFICATIONS
// =============================================

async function notifyLoanApplicationSubmitted(
  applicationId: string,
  memberUserId: string,
  memberName: string,
  amountApplied: number,
  loanProductName: string
) {
  try {
    // Get member email
    const memberUser = await db.user.findUnique({
      where: { id: memberUserId },
      select: { email: true },
    });

    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amountApplied);

    // Notify member
    await db.notification.create({
      data: {
        userId: memberUserId,
        type: NotificationType.IN_APP,
        subject: "Loan Application Submitted Successfully",
        message: `Your loan application for ${formattedAmount} (${loanProductName}) has been submitted and is under review. You will be notified once a decision is made.`,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    // Send email notification
    if (memberUser?.email) {
      await sendLoanApplicationEmail(
        memberUser.email,
        memberName,
        loanProductName,
        amountApplied
      );
    }

    // Notify branch managers and accountants
    const approvers = await db.user.findMany({
      where: {
        OR: [
          { role: "BRANCHMANAGER" },
          { role: "ADMIN" },
        ],
        isActive: true,
      },
      select: { id: true, name: true, role: true },
    });

    for (const approver of approvers) {
      await db.notification.create({
        data: {
          userId: approver.id,
          type: NotificationType.IN_APP,
          subject: "New Loan Application Pending Review",
          message: `${memberName} has applied for a ${loanProductName} loan of ${formattedAmount}. Please review and approve/reject.`,
          targetAddress: `/dashboard/loans/manager-loan-process-tracking?highlight=${applicationId}`,
          sentAt: new Date(),
          isRead: false,
          status: "SENT",
        },
      });
    }

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error notifying loan application submission:", error);
  }
}

async function notifyLoanApproved(
  memberUserId: string,
  memberName: string,
  memberEmail: string,
  grossAmount: number,
  netAmount: number,
  deductions: any,
  loanProductName: string,
  accountNumber: string,
  dueDate: Date
) {
  try {
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("en-UG", {
        style: "currency",
        currency: "UGX",
        minimumFractionDigits: 0,
      }).format(amount);

    const formattedDueDate = new Intl.DateTimeFormat("en-UG", {
      dateStyle: "long",
    }).format(dueDate);

    // Build deduction breakdown
    let deductionDetails = "";
    if (deductions.processingFee > 0) {
      deductionDetails += `\n- Processing Fee: ${formatCurrency(
        deductions.processingFee
      )}`;
    }
    if (deductions.insurance > 0) {
      deductionDetails += `\n- Loan Insurance: ${formatCurrency(
        deductions.insurance
      )}`;
    }
    if (deductions.shareCapital > 0) {
      deductionDetails += `\n- Share Capital: ${formatCurrency(
        deductions.shareCapital
      )}`;
    }
    if (deductions.existingLoanRecovery > 0) {
      deductionDetails += `\n- Existing Loan Recovery: ${formatCurrency(
        deductions.existingLoanRecovery
      )}`;
    }

    const totalDeductions = formatCurrency(
      deductions.processingFee +
        deductions.insurance +
        deductions.shareCapital +
        deductions.existingLoanRecovery
    );

    const message = `Congratulations ${memberName}!

Your ${loanProductName} loan application has been APPROVED and DISBURSED!

💰 LOAN DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Approved Amount: ${formatCurrency(grossAmount)}
- Deductions: ${totalDeductions}${deductionDetails}
- Net Amount Credited: ${formatCurrency(netAmount)}

📊 ACCOUNT INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Account Number: ${accountNumber}
- New Balance: Check your account

⏰ REPAYMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━
- Due Date: ${formattedDueDate}

The net amount of ${formatCurrency(
      netAmount
    )} has been credited to your account. Please ensure timely repayment.`;

    // In-app notification
    await db.notification.create({
      data: {
        userId: memberUserId,
        type: NotificationType.IN_APP,
        subject: "🎉 Loan Approved & Disbursed!",
        message,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    // Send email notification for disbursement
    if (memberEmail) {
      await sendTransactionAlertEmail(
        memberEmail,
        memberName,
        "DISBURSEMENT",
        netAmount
      );
    }

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error notifying loan approval:", error);
  }
}

async function notifyLoanRejected(
  memberUserId: string,
  memberName: string,
  amountApplied: number,
  loanProductName: string,
  rejectionReason: string
) {
  try {
    const formattedAmount = new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: "UGX",
      minimumFractionDigits: 0,
    }).format(amountApplied);

    await db.notification.create({
      data: {
        userId: memberUserId,
        type: NotificationType.IN_APP,
        subject: "Loan Application Decision",
        message: `We regret to inform you that your ${loanProductName} loan application for ${formattedAmount} was not approved.

Reason: ${rejectionReason}

You may contact your branch manager for more details or submit a new application.`,
        targetAddress: `/dashboard/my-loans`,
        sentAt: new Date(),
        isRead: false,
        status: "SENT",
      },
    });

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error notifying loan rejection:", error);
  }
}

// Helper function to get or create income categories
async function getOrCreateIncomeCategory(tx: any, code: string, name: string) {
  let category = await tx.budgetCategory.findFirst({
    where: { code, kind: "INCOME" },
  });

  if (!category) {
    category = await tx.budgetCategory.create({
      data: {
        name,
        code,
        kind: "INCOME",
        isActive: true,
        parentId: null,
      },
    });
  }

  return category;
}

// =============================================
// MAIN FUNCTIONS
// =============================================

// Fetch all loan applications with relations
// FILE: actions/loanApplications.ts

// Update the getAllLoanApplications function to include accounts
export async function getAllLoanApplications() {
  try {
    const loanApplications = await db.loanApplication.findMany({
      include: {
        loanProduct: {
          select: {
            id: true,
            name: true,
            minAmount: true,
            maxAmount: true,
            interestRate: true,
            repaymentPeriodDays: true,
          },
        },
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
            // ✅ ADD THIS: Include the first active account
            accounts: {
              where: { status: "ACTIVE" },
              take: 1,
              orderBy: { openedAt: "asc" },
              select: {
                id: true,
                accountNumber: true,
                balance: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        loanOfficer: {
          select: {
            id: true,
            name: true,
          },
        },
        allocatedTeller: {
          select: {
            id: true,
            name: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
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
      orderBy: {
        applicationDate: "desc",
      },
    });

    // ✅ Transform the data to match the expected structure
    return loanApplications.map((app) => ({
      ...app,
      member: {
        ...app.member,
        account: app.member.accounts[0] || null, // Get first account or null
      },
    }));
  } catch (error) {
    console.error("Error fetching loan applications:", error);
    return [];
  }
}

// Fetch loan applications by member ID
export async function getLoanApplicationsByMemberId(memberId: string) {
  try {
    const loanApplications = await db.loanApplication.findMany({
      where: { memberId },
      include: {
        loanProduct: true,
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
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
      orderBy: {
        applicationDate: "desc",
      },
    });
    return loanApplications;
  } catch (error) {
    console.error("Error fetching member loan applications:", error);
    return [];
  }
}

// Fetch single loan application by ID
export async function getLoanApplicationById(id: string) {
  try {
    const loanApplication = await db.loanApplication.findUnique({
      where: { id },
      include: {
        loanProduct: true,
        member: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        allocatedTeller: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
          },
        },
        loan: {
          include: {
            repayments: {
              orderBy: {
                repaymentDate: "desc",
              },
            },
            branch: true,
          },
        },
      },
    });
    return loanApplication;
  } catch (error) {
    console.error("Error fetching loan application:", error);
    return null;
  }
}

// Create new loan application
export async function createLoanApplication(
  data: LoanApplicationCreateDTO,
  applicantUserId: string
) {
  try {
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
          include: {
            loanApplication: {
              include: {
                loanProduct: true,
              },
            },
          },
        },
      },
    });

    if (!member || !member.isApproved) {
      return {
        error: "Member not found or not approved",
        data: null,
      };
    }

    if (member.accounts.length === 0) {
      return {
        error:
          "Member must have at least one active account to apply for a loan",
        data: null,
      };
    }

    // Check for shares account - Allow share deduction to add to existing shares
    const hasSharesAccount = member.accounts.some(
      (account) => account.accountType?.isShareAccount === true
    );

    // Calculate total outstanding balance
    const totalOutstandingBalance = member.loans.reduce(
      (sum, loan) => sum + loan.outstandingBalance,
      0
    );

    // Check loan eligibility
    const activeLoansCount = member.loans.filter(
      (loan) => loan.status === "DISBURSED" || loan.status === "OVERDUE"
    ).length;

    const hasOverdueLoans = member.loans.some(
      (loan) => loan.status === "OVERDUE"
    );

    if (hasOverdueLoans) {
      return {
        error: "Member has overdue loans that must be cleared first",
        data: null,
      };
    }

    if (activeLoansCount >= 3) {
      return {
        error: "Member has reached maximum limit of active loans (2)",
        data: null,
      };
    }

    // Validate loan product
    const loanProduct = await db.loanProduct.findUnique({
      where: { id: data.loanProductId },
    });

    if (!loanProduct || !loanProduct.isActive) {
      return {
        error: "Loan product not found or not available",
        data: null,
      };
    }

    // Validate amount is within loan product limits
    if (
      data.amountApplied < loanProduct.minAmount ||
      data.amountApplied > loanProduct.maxAmount
    ) {
      return {
        error: `Loan amount must be between ${loanProduct.minAmount} and ${loanProduct.maxAmount}`,
        data: null,
      };
    }

    // Validate repayment period is within loan product limits
    // Convert LoanProduct days to months for comparison (approx 30 days = 1 month)
    const maxMonths = Math.ceil((loanProduct.repaymentPeriodDays || 0) / 30);
    if (data.repaymentPeriodMonths && data.repaymentPeriodMonths > maxMonths) {
        return {
            error: `Repayment period cannot exceed ${maxMonths} months for this product.`,
            data: null
        };
    }

    // Create loan application
    const loanApplication = await db.loanApplication.create({
      data: {
        loanProductId: data.loanProductId,
        memberId: data.memberId,
        amountApplied: data.amountApplied,
        purpose: data.purpose?.trim() || null,
        status: "PENDING",
        stage: "SUBMITTED",
        applicantId: applicantUserId,
        loanOfficerId: data.loanOfficerId || null,
        employer: data.employer?.trim() || null,
        employmentStatus: data.employmentStatus?.trim() || null,
        grossMonthlyIncome: data.grossMonthlyIncome || null,
        netMonthlyIncome: data.netMonthlyIncome || null,

        repaymentPeriodMonths: data.repaymentPeriodMonths || null,
        repaymentStartDate: data.repaymentStartDate
          ? new Date(data.repaymentStartDate)
          : null,
        modeOfRepayment: data.modeOfRepayment?.trim() || null,
        interestType: data.interestType || null,
        collateralOffered: data.collateralOffered?.trim() || null,
        guarantors: data.guarantors
          ? (data.guarantors.filter((g) => g?.fullName?.trim()) as any)
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
        applicantSignatureDate: data.applicantSignatureDate || new Date(),
        guarantorAgreementAccepted: data.guarantorAgreementAccepted,
        guarantorSignatureDate: data.guarantorSignatureDate || new Date(),
        debtToIncomeRatio: data.debtToIncomeRatio || null,
      },
      include: {
        loanProduct: true,
        member: {
          include: {
            user: true,
            loans: {
              where: {
                status: {
                  in: ["DISBURSED", "OVERDUE"],
                },
              },
              include: {
                loanApplication: {
                  include: {
                    loanProduct: true,
                  },
                },
              },
            },
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Send notifications
    await notifyLoanApplicationSubmitted(
      loanApplication.id,
      member.user.id,
      member.user.name,
      data.amountApplied,
      loanProduct.name
    );

    revalidatePath("/dashboard/loan-applications");
    revalidatePath("/dashboard/loans/manager-loan-process-tracking");
    return {
      error: null,
      data: loanApplication,
    };
  } catch (error) {
    console.error("Error creating loan application:", error);
    return {
      error: "Failed to create loan application. Please try again.",
      data: null,
    };
  }
}

// Update loan application (only if PENDING)
export async function updateLoanApplication(data: LoanApplicationUpdateDTO) {
  try {
    const existingApplication = await db.loanApplication.findUnique({
      where: { id: data.id },
      include: { loanProduct: true },
    });

    if (!existingApplication) {
      return {
        error: "Loan application not found",
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

    if (data.amountApplied !== undefined) {
      const loanProduct = existingApplication.loanProduct;
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

    if (data.repaymentPeriodMonths !== undefined) {
        const loanProduct = existingApplication.loanProduct;
        const maxMonths = Math.ceil((loanProduct.repaymentPeriodDays || 0) / 30);
        if (data.repaymentPeriodMonths > maxMonths) {
            return {
                error: `Repayment period cannot exceed ${maxMonths} months for this product.`,
                data: null
            };
        }
        updateData.repaymentPeriodMonths = data.repaymentPeriodMonths;
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
      
      // Reset interest type if product changes, or keep if valid? 
      // For now, let's just allow it to stay or be updated via data.interestType
    }

    if (data.interestType !== undefined) {
        updateData.interestType = data.interestType;
    }

    const updatedApplication = await db.loanApplication.update({
      where: { id: data.id },
      data: updateData,
      include: {
        loanProduct: true,
        member: {
          include: {
            user: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/loan-applications");
    revalidatePath(`/dashboard/loan-applications/${data.id}`);
    return {
      error: null,
      data: updatedApplication,
    };
  } catch (error) {
    console.error("Error updating loan application:", error);
    return {
      error: "Failed to update loan application. Please try again.",
      data: null,
    };
  }
}

// Approve or reject loan application
export async function decideLoanApplication(
  data: LoanApplicationDecisionDTO,
  approverId: string
) {
  try {
    // Verify approver has permission
    const approver = await db.user.findUnique({
      where: { id: approverId },
      select: { role: true, name: true, email: true },
    });

    if (
      !approver ||
      !["ADMIN", "BRANCHMANAGER", "ACCOUNTANT"].includes(approver.role)
    ) {
      return {
        error: "You don't have permission to approve loan applications",
        data: null,
      };
    }

    const application = await db.loanApplication.findUnique({
      where: { id: data.id },
      include: {
        loanProduct: true,
        member: {
          include: {
            user: true,
            accounts: {
              where: { status: "ACTIVE" },
              include: { accountType: true },
              orderBy: { openedAt: "asc" },
              take: 1,
            },
            loans: {
              where: {
                status: { in: ["DISBURSED", "OVERDUE"] },
              },
            },
          },
        },
      },
    });

    if (!application)
      return { error: "Loan application not found", data: null };

    if (application.status !== "PENDING") {
      return {
        error: "Can only decide on pending loan applications",
        data: null,
      };
    }

    if (data.status === "REJECTED" && !data.rejectionReason?.trim()) {
      return {
        error: "Rejection reason is required for rejected applications",
        data: null,
      };
    }

    // Use LoanService for the heavy lifting
    let result;
    if (data.status === "APPROVED") {
      result = await LoanService.approve({
        applicationId: data.id,
        managerId: approverId,
        approvedAmount: data.amountGranted || 0,
        tellerId: data.allocatedTellerId,
        approvedRepaymentPeriod: data.approvedRepaymentPeriod,
      });
    } else {
      result = await LoanService.reject({
        applicationId: data.id,
        managerId: approverId,
        reason: data.rejectionReason || "No reason provided",
      });
    }

    if (!result.ok) {
      throw new Error(result.error);
    }

    revalidatePath("/dashboard/loan-applications");
    revalidatePath(`/dashboard/loan-applications/${data.id}`);
    revalidatePath("/dashboard/loans/manager-loan-process-tracking");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/income");
    revalidatePath("/dashboard/transactions");

    return {
      error: null,
      data: result.data,
    };
  } catch (error) {
    console.error("Error deciding loan application:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to process loan decision. Please try again.",
      data: null,
    };
  }
}

// Get loan application statistics
export async function getLoanApplicationStatistics() {
  try {
    const [pending, approved, rejected, disbursed] = await Promise.all([
      db.loanApplication.count({
        where: { status: LoanStatus.PENDING },
      }),
      db.loanApplication.count({
        where: { status: LoanStatus.APPROVED },
      }),
      db.loanApplication.count({
        where: { status: LoanStatus.REJECTED },
      }),
      db.loanApplication.count({
        where: { status: LoanStatus.DISBURSED },
      }),
    ]);

    const totalAmount = await db.loanApplication.aggregate({
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
    console.error("Error fetching loan application statistics:", error);
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      disbursed: 0,
      totalAmount: 0,
    };
  }
}

// Get members for loan application
export async function getMembersForLoanApplication() {
  try {
    const members = await db.member.findMany({
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
            image: true,
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
        memberNumber: "asc",
      },
    });
    return members;
  } catch (error) {
    console.error("Error fetching members for loan application:", error);
    return [];
  }
}

// Get active loan products
export async function getActiveLoanProducts() {
  try {
    const loanProducts = await db.loanProduct.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return loanProducts;
  } catch (error) {
    console.error("Error fetching active loan products:", error);
    return [];
  }
}
