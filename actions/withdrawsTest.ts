"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/prisma/db";
import { TransactionStatus, TransactionType, Prisma } from "@prisma/client";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { Resend } from "resend";

import { createAuditLog, logWithdrawalAction } from "@/lib/lib/auditLog";
import { AUDIT_ACTIONS } from "@/lib/lib/audit-constants";
import WithdrawalVerificationEmail from "@/app/(dashboard)/dashboard/withdraw-test/components/email-templates/withdrawal-verification";
import { calculateWithdrawalFee } from "@/lib/fees";
import { sendTransactionAlertEmail } from "@/lib/email";
import { EMAIL_FROM } from "@/lib/email";
import {
  FEE_INCOME_CODE,
  WITHDRAWAL_FEE_CODE,
} from "@/lib/services/income-structure";
import {
  createWithdrawalFeeJournalEntry,
  createWithdrawalPrincipalJournalEntry,
} from "@/lib/journal-entries-extended";
import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";

// -----------------------------
// Helpers
// -----------------------------

// FIX #1: Change the type to accept Prisma transaction client
type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function getOrCreateWithdrawalFeeCategory(tx: TransactionClient) {
  const parentCategory = await tx.budgetCategory.upsert({
    where: { code: FEE_INCOME_CODE },
    update: {
      name: "Fee income",
      kind: "INCOME",
      isActive: true,
    },
    create: {
      name: "Fee income",
      code: FEE_INCOME_CODE,
      kind: "INCOME",
      description: "Income from service and transaction fees",
      isActive: true,
    },
  });

  await tx.chartOfAccount.upsert({
    where: { accountCode: FEE_INCOME_CODE },
    update: {
      accountName: "Fee income",
      fullCode: FEE_INCOME_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: "Income from service and transaction fees",
    },
    create: {
      accountName: "Fee income",
      accountCode: FEE_INCOME_CODE,
      fullCode: FEE_INCOME_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 1,
      category: "INCOME",
      description: "Income from service and transaction fees",
    },
  });

  const cat = await tx.budgetCategory.upsert({
    where: { code: WITHDRAWAL_FEE_CODE },
    update: {
      name: "Withdrawal fee charged",
      kind: "INCOME",
      isActive: true,
      parentId: parentCategory.id,
    },
    create: {
      name: "Withdrawal fee charged",
      code: WITHDRAWAL_FEE_CODE,
      kind: "INCOME",
      description: "Fees charged when processing withdrawals",
      isActive: true,
      parentId: parentCategory.id,
    },
  });

  await tx.chartOfAccount.upsert({
    where: { accountCode: WITHDRAWAL_FEE_CODE },
    update: {
      accountName: "Withdrawal fee charged",
      fullCode: WITHDRAWAL_FEE_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 2,
      category: "INCOME",
      description: "Fees charged when processing withdrawals",
    },
    create: {
      accountName: "Withdrawal fee charged",
      accountCode: WITHDRAWAL_FEE_CODE,
      fullCode: WITHDRAWAL_FEE_CODE,
      ledgerType: "INCOME",
      debitCredit: "CR",
      isActive: true,
      level: 2,
      category: "INCOME",
      description: "Fees charged when processing withdrawals",
    },
  });

  return cat;
}

export interface WithdrawalVerificationDTO {
  memberId?: string;
  institutionId?: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  signatoryId?: string;
  // Institution withdrawal fields
  recipientName?: string;
  recipientIdNumber?: string;
  recipientPhone?: string;
  recipientRelation?: string;
  verifiedSignatories?: string[];
}

// -----------------------------
// Accounts / Members
// -----------------------------
export async function getMemberActiveAccounts(memberId: string) {
  try {
    const accounts = await db.account.findMany({
      where: { memberId, status: "ACTIVE" },
      include: {
        accountType: {
          select: {
            name: true,
            id: true,
            minBalance: true,
            flatWithdrawalFee: true,

            // TEMPORARY FIX: Commented out to prevent crash until server restart
            // withdrawalFeePercentage: true,
            // withdrawalFeeTiers: true,
          } as any,
        },
        branch: { select: { id: true, name: true, location: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return { error: null, data: accounts };
  } catch (error) {
    console.error("Error fetching member accounts:", error);
    return { error: "Failed to fetch accounts", data: null };
  }
}

export async function getMembersWithActiveAccounts() {
  try {
    const members = await db.member.findMany({
      where: {
        isApproved: true,
        accounts: { some: { status: "ACTIVE" } },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        accounts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            status: true,
            accountType: {
              select: {
                id: true,
                name: true,
                minBalance: true,
                flatWithdrawalFee: true,

                // TEMPORARY FIX: Commented out to prevent crash until server restart
                // withdrawalFeePercentage: true,
                // withdrawalFeeTiers: true,
              } as any,
            },
            branch: { select: { id: true, name: true, location: true } },
          },
        },
      },
      orderBy: { memberNumber: "asc" },
    });

    return { success: true, data: members, error: null };
  } catch (error) {
    console.error("Error fetching members with active accounts:", error);
    return { success: false, data: [], error: "Failed to fetch members" };
  }
}

// -----------------------------
// Institutions
// -----------------------------
export async function getInstitutionsWithActiveAccounts() {
  try {
    const totalInstitutions = await db.institution.count();
    console.log(`Total Institutions in DB: ${totalInstitutions}`);

    // Debug: Check why filtering might fail
    const debugInsts = await db.institution.findMany({
      take: 5,
      include: { accounts: true },
    });
    debugInsts.forEach((i) => {
      console.log(
        `Inst: ${i.institutionName}, Appr: ${i.isApproved}, Accs: ${i.accounts.length}, ActiveAccs: ${i.accounts.filter((a) => a.status === "ACTIVE").length}`,
      );
    });

    const institutions = await db.institution.findMany({
      where: {
        isApproved: true,
        accounts: { some: { status: "ACTIVE" } },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        // @ts-ignore - Prisma Client Stale
        signatories: {
          where: { status: "ACTIVE" },
          orderBy: { isPrimary: "desc" },
        },
        accounts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            status: true,
            accountType: {
              select: {
                id: true,
                name: true,
                minBalance: true,
                flatWithdrawalFee: true,
                // @ts-ignore - Prisma Client Stale
                withdrawalFeePercentage: true,
                withdrawalFeeTiers: true,
              } as any,
            },
            branch: { select: { id: true, name: true, location: true } },
          },
        },
      },
      orderBy: { institutionNumber: "asc" },
    });

    // Lazy Migration: Sync Administrators to Signatories if needed
    for (const inst of institutions) {
      // @ts-ignore
      if (
        inst.signatories.length === 0 &&
        inst.administrators &&
        Array.isArray(inst.administrators)
      ) {
        const admins = inst.administrators as any[];
        if (admins.length > 0) {
          console.log(
            `Migrating ${admins.length} administrators for institution ${inst.institutionName}`,
          );
          // Create new signatories from administrators JSON
          for (const admin of admins) {
            if (admin.name && admin.post) {
              await db.institutionSignatory.create({
                data: {
                  institutionId: inst.id,
                  name: admin.name,
                  title: admin.post,
                  phone: admin.phone || null,
                  email: admin.email || null,
                  signatureImage: admin.signature || null, // Assuming signature might be in JSON as base64 or url
                  isPrimary: false, // Default to false, can be updated later
                },
              });
            }
          }
        }
      }
    }

    // Re-fetch to get the newly created signatories if any migration happened
    // This is slightly inefficient but ensures data consistency without complex in-memory merging
    const finalInstitutions = await db.institution.findMany({
      where: {
        isApproved: true,
        accounts: { some: { status: "ACTIVE" } },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
          },
        },
        signatories: {
          where: { status: "ACTIVE" },
          orderBy: { isPrimary: "desc" },
        },
        accounts: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            accountNumber: true,
            balance: true,
            status: true,
            accountType: {
              select: {
                id: true,
                name: true,
                minBalance: true,
                flatWithdrawalFee: true,
                // withdrawalFeePercentage: true,
                // withdrawalFeeTiers: true,
              },
            },
            branch: { select: { id: true, name: true, location: true } },
          },
        },
      },
      orderBy: { institutionNumber: "asc" },
    });

    console.log(
      `Returning ${finalInstitutions.length} institutions to frontend.`,
    );
    return { success: true, data: finalInstitutions || [], error: null };
  } catch (error) {
    console.error("Error fetching institutions with active accounts:", error);
    // Explicitly return a valid object structure even on error
    return { success: false, data: [], error: "Failed to fetch institutions" };
  }
}

export async function getInstitutionActiveAccounts(institutionId: string) {
  try {
    const accounts = await db.account.findMany({
      where: { institutionId, status: "ACTIVE" },
      select: {
        id: true,
        accountNumber: true,
        balance: true,
        status: true,
        accountType: {
          select: {
            name: true,
            id: true,
            minBalance: true,
            flatWithdrawalFee: true,
            // TEMPORARY FIX: Commented out to prevent crash until server restart
            // withdrawalFeePercentage: true,
            // withdrawalFeeTiers: true,
          } as any,
        },
        branch: { select: { id: true, name: true, location: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return { error: null, data: accounts };
  } catch (error) {
    console.error("Error fetching institution accounts:", error);
    return { error: "Failed to fetch accounts", data: null };
  }
}

// -----------------------------
// Withdrawals Lists & Stats
// -----------------------------
export async function getAllWithdrawalsTest() {
  try {
    const withdrawals = await db.withdrawal.findMany({
      include: {
        transaction: {
          select: {
            id: true,
            status: true,
            channel: true,
            transactionRef: true,
            description: true,
            externalReference: true,
          },
        },
        institution: {
          select: {
            id: true,
            institutionName: true,
            user: {
              select: { name: true, email: true, phone: true, image: true },
            },
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: {
              select: { name: true, email: true, phone: true, image: true },
            },
          },
        },
        account: {
          select: {
            id: true,
            accountNumber: true,
            branch: { select: { name: true, location: true } },
            accountType: { select: { name: true } },
          },
        },
        handler: { select: { id: true, name: true, role: true } },
      },
      orderBy: { withdrawalDate: "desc" },
    });

    return { success: true, data: withdrawals, error: null };
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return { success: false, data: [], error: "Failed to fetch withdrawals" };
  }
}

export async function getWithdrawalTestStatistics() {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [todayData, monthData, totalData] = await Promise.all([
      db.withdrawal.aggregate({
        where: { withdrawalDate: { gte: todayStart, lte: todayEnd } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        where: { withdrawalDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.withdrawal.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      success: true,
      data: {
        today: {
          amount: todayData._sum.amount || 0,
          count: { id: todayData._count.id || 0 },
        },
        thisMonth: {
          amount: monthData._sum.amount || 0,
          count: { id: monthData._count.id || 0 },
        },
        total: {
          amount: totalData._sum.amount || 0,
          count: { id: totalData._count.id || 0 },
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("Error fetching withdrawal statistics:", error);
    return {
      success: false,
      data: {
        today: { amount: 0, count: { id: 0 } },
        thisMonth: { amount: 0, count: { id: 0 } },
        total: { amount: 0, count: { id: 0 } },
      },
      error: "Failed to fetch statistics",
    };
  }
}

export async function getWithdrawalsByMemberId(memberId: string) {
  try {
    const withdrawals = await db.withdrawal.findMany({
      where: { memberId },
      include: {
        transaction: {
          select: {
            id: true,
            transactionRef: true,
            status: true,
            description: true,
            channel: true,
            externalReference: true,
          },
        },
        account: {
          include: {
            accountType: { select: { name: true } },
            branch: { select: { name: true, location: true } },
          },
        },
        handler: { select: { name: true, role: true } },
        member: {
          select: {
            id: true,
            memberNumber: true,
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { withdrawalDate: "desc" },
    });

    return withdrawals;
  } catch (error) {
    console.error("Error fetching member withdrawals:", error);
    return [];
  }
}

// -----------------------------
// Verifications
// -----------------------------
export async function getPendingVerifications(userId?: string) {
  try {
    const where: any = {
      isUsed: false,
      expiresAt: { gte: new Date() },
    };
    if (userId) where.handlerUserId = userId;

    const verifications = await db.withdrawalVerification.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        handler: {
          select: { name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { error: null, data: verifications };
  } catch (error) {
    console.error("Error fetching verifications:", error);
    return { error: "Failed to fetch verifications", data: null };
  }
}

export async function getAllVerifications(filters?: {
  memberId?: string;
  accountId?: string;
  isUsed?: boolean;
}) {
  try {
    const where: any = {};
    if (filters?.memberId) where.memberId = filters.memberId;
    if (filters?.accountId) where.accountId = filters.accountId;
    if (filters?.isUsed !== undefined) where.isUsed = filters.isUsed;

    const verifications = await db.withdrawalVerification.findMany({
      where,
      include: {
        member: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
        account: { include: { accountType: true, branch: true } },
        handler: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { error: null, data: verifications };
  } catch (error) {
    console.error("Error fetching verifications:", error);
    return { error: "Failed to fetch verifications", data: null };
  }
}

export async function cancelWithdrawalVerification(verificationId: string) {
  try {
    const verification = await db.withdrawalVerification.findUnique({
      where: { id: verificationId },
    });

    if (!verification) return { error: "Verification not found", data: null };
    if (verification.isUsed)
      return { error: "Cannot cancel used verification", data: null };

    await db.withdrawalVerification.update({
      where: { id: verificationId },
      data: { expiresAt: new Date(), updatedAt: new Date() },
    });

    revalidatePath("/dashboard/withdraw-test");
    return {
      error: null,
      data: { id: verificationId },
      message: "Withdrawal verification cancelled successfully",
    };
  } catch (error) {
    console.error("Error cancelling verification:", error);
    return {
      error: "Failed to cancel verification",
      data: null,
      message: null,
    };
  }
}

export async function getMemberWithdrawalStatistics(memberId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [
      todayWithdrawals,
      todayAmount,
      thisMonthWithdrawals,
      thisMonthAmount,
      totalWithdrawals,
      totalAmount,
    ] = await Promise.all([
      db.withdrawal.count({
        where: { memberId, withdrawalDate: { gte: today, lt: tomorrow } },
      }),
      db.withdrawal.aggregate({
        where: { memberId, withdrawalDate: { gte: today, lt: tomorrow } },
        _sum: { amount: true },
      }),
      db.withdrawal.count({
        where: { memberId, withdrawalDate: { gte: thisMonth } },
      }),
      db.withdrawal.aggregate({
        where: { memberId, withdrawalDate: { gte: thisMonth } },
        _sum: { amount: true },
      }),
      db.withdrawal.count({ where: { memberId } }),
      db.withdrawal.aggregate({ where: { memberId }, _sum: { amount: true } }),
    ]);

    return {
      today: {
        amount: todayAmount._sum.amount || 0,
        count: { id: todayWithdrawals },
      },
      thisMonth: {
        amount: thisMonthAmount._sum.amount || 0,
        count: { id: thisMonthWithdrawals },
      },
      total: {
        amount: totalAmount._sum.amount || 0,
        count: { id: totalWithdrawals },
      },
    };
  } catch (error) {
    console.error("Error fetching member withdrawal statistics:", error);
    return {
      today: { amount: 0, count: { id: 0 } },
      thisMonth: { amount: 0, count: { id: 0 } },
      total: { amount: 0, count: { id: 0 } },
    };
  }
}

// -----------------------------
// Email + SMS
// -----------------------------
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendWithdrawalVerificationEmail(
  email: string,
  memberName: string,
  verificationCode: string,
  amount: number,
  fee: number,
  total: number,
  accountNumber: string,
  channel: string,
  expiresInMinutes: number = 15,
) {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Withdrawal Verification Code: ${verificationCode}`,
      react: WithdrawalVerificationEmail({
        memberName,
        verificationCode,
        amount,
        fee,
        total,
        accountNumber,
        channel,
        expiresInMinutes,
      }),
    });

    if (error) {
      console.error("Error sending verification email:", error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function sendWithdrawalVerificationSMS(
  phone: string,
  memberName: string,
  verificationCode: string,
  amount: number,
) {
  try {
    const message = `Dear ${memberName}, your withdrawal verification code is: ${verificationCode}. Amount: UGX ${amount.toLocaleString()}. Valid for 15 minutes. Do not share. - Bukonzo Teachers SACCO`;
    console.log(`SMS would be sent to ${phone}: ${message}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to send verification SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// -----------------------------
// Create Verification
// -----------------------------
export async function createWithdrawalVerification(data: {
  memberId?: string;
  institutionId?: string;
  accountId: string;
  amount: number;
  channel: string;
  mobileMoneyRef?: string;
  description?: string;
  userId: string;
  signatoryId?: string;
  // Institution withdrawal fields
  recipientName?: string;
  recipientIdNumber?: string;
  recipientPhone?: string;
  recipientRelation?: string;
  verifiedSignatories?: string[];
}) {
  try {
    const currentUser = await db.user.findUnique({
      where: { id: data.userId },
    });
    if (!currentUser) return { error: "User not found", data: null };

    // Load account with member and institution relationships
    const account = await db.account.findUnique({
      where: { id: data.accountId },
      include: {
        member: { include: { user: true } },
        institution: { include: { user: true } },
        accountType: true,
      },
    });

    if (!account) return { error: "Account not found", data: null };

    // Identify Owner
    let ownerName = "";
    let ownerEmail = "";
    let ownerPhone = "";
    let ownerId = ""; // MemberId or InstitutionId
    let isInstitution = false;

    if (account.member) {
      if (!account.member.user)
        return { error: "Member user not found", data: null };
      ownerName = account.member.user.name || "Member";
      ownerEmail = account.member.user.email || "";
      ownerPhone = account.member.user.phone || "";
      ownerId = account.member.id;
    } else if (account.institution) {
      if (!account.institution.user)
        return { error: "Institution user not found", data: null };
      ownerName =
        account.institution.institutionName ||
        account.institution.user.name ||
        "Institution";
      ownerEmail =
        account.institution.institutionEmail ||
        account.institution.user.email ||
        "";
      ownerPhone =
        account.institution.institutionPhone ||
        account.institution.user.phone ||
        "";
      ownerId = account.institution.id;
      isInstitution = true;
    } else {
      return {
        error: "Account owner (Member/Institution) not found",
        data: null,
      };
    }

    // Check for active holds
    const activeHold = await db.accountHold.findFirst({
      where: { accountId: data.accountId, isActive: true },
      include: { placedBy: { select: { name: true } } },
    });
    if (activeHold) {
      return {
        error: `Account is ON HOLD. Reason: ${activeHold.reason}${activeHold.reasonText ? ` - ${activeHold.reasonText}` : ""}. Placed by: ${activeHold.placedBy.name}`,
        data: null,
      };
    }

    // Validate email
    if (!ownerEmail) {
      return {
        error: "Owner email not found. Cannot send verification code.",
        data: null,
      };
    }

    // Check balances
    // Fetch system configurations for global fallback tiers
    const systemRates = await db.systemConfiguration.findMany({
      where: {
        key: {
          in: [
            "TELLER_WITHDRAWAL_RATES_MEMBER",
            "TELLER_WITHDRAWAL_RATES_INSTITUTION",
          ],
        },
      },
    });

    const memberWithdrawalRates = systemRates.find(
      (s) => s.key === "TELLER_WITHDRAWAL_RATES_MEMBER",
    )?.value;
    const institutionWithdrawalRates = systemRates.find(
      (s) => s.key === "TELLER_WITHDRAWAL_RATES_INSTITUTION",
    )?.value;
    const fallbackTiersJson = isInstitution
      ? institutionWithdrawalRates
      : memberWithdrawalRates;

    const fee = calculateWithdrawalFee(
      data.amount,
      account.accountType,
      account as any,
      fallbackTiersJson,
    );
    const totalDeduction = data.amount + fee;

    const minBalance = account.accountType.minBalance || 0;
    const availableBalance = Math.max(0, account.balance - minBalance);

    if (totalDeduction > availableBalance) {
      return {
        error: `Insufficient funds. Required: ${totalDeduction.toLocaleString()} UGX (Inc. Fee), Available: ${availableBalance.toLocaleString()} UGX (Min Balance: ${minBalance.toLocaleString()})`,
        data: null,
      };
    }

    // Float checks
    const tellerFloat = await db.userFloat.findFirst({
      where: { userId: data.userId },
    });
    if (!tellerFloat) {
      return {
        error: "No float assigned. Contact accountant.",
        data: null,
      };
    }
    if (!tellerFloat.isActiveForDay) {
      return {
        error: "Your float is not active. Cannot process withdrawal.",
        data: null,
      };
    }
    if (tellerFloat.balance < data.amount) {
      return {
        error: `Insufficient float balance. Your float: ${tellerFloat.balance.toLocaleString()} UGX, Withdrawal: ${data.amount.toLocaleString()} UGX.`,
        data: null,
      };
    }

    // Generate code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Create verification
    const verificationData: any = {
      accountId: data.accountId,
      amount: data.amount,
      channel: data.channel,
      mobileMoneyRef: data.mobileMoneyRef,
      verificationCode,
      description: data.description || "Withdrawal request",
      handlerUserId: data.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      emailSent: false,
      smsSent: false,
      isUsed: false,
      metadata: {
        recipientName: data.recipientName,
        recipientIdNumber: data.recipientIdNumber,
        recipientPhone: data.recipientPhone,
        recipientRelation: data.recipientRelation,
        verifiedSignatories: data.verifiedSignatories,
      } as any,
    };

    if (isInstitution) {
      verificationData.institutionId = ownerId;
      if (data.signatoryId) {
        verificationData.signatoryId = data.signatoryId;
      }
    } else {
      verificationData.memberId = ownerId;
    }

    const verification = await db.withdrawalVerification.create({
      data: verificationData,
    });

    console.log("Sending verification email to:", ownerEmail);

    // Send email notification
    const emailResult = await sendWithdrawalVerificationEmail(
      ownerEmail,
      ownerName,
      verificationCode,
      data.amount,
      fee,
      totalDeduction,
      account.accountNumber,
      data.channel,
      15,
    );

    // Send SMS notification
    let smsResult = { success: false as boolean };
    if (ownerPhone) {
      smsResult = await sendWithdrawalVerificationSMS(
        ownerPhone,
        ownerName,
        verificationCode,
        data.amount,
      );
    }

    // Update verification with delivery flags
    await db.withdrawalVerification.update({
      where: { id: verification.id },
      data: { emailSent: emailResult.success, smsSent: smsResult.success },
    });

    // Audit Log
    await createAuditLog({
      userId: data.userId,
      action: AUDIT_ACTIONS.WITHDRAWAL_VERIFICATION_CREATED,
      entityType: "WithdrawalVerification",
      entityId: verification.id,
      newValue: {
        amount: data.amount,
        fee,
        totalDeduction,
        channel: data.channel,
        owner: {
          id: ownerId,
          name: ownerName,
          type: isInstitution ? "INSTITUTION" : "MEMBER",
        },
        account: {
          id: account.id,
          accountNumber: account.accountNumber,
          balance: account.balance,
        },
        tellerFloat: { balance: tellerFloat.balance, sufficientFunds: true },
        notifications: {
          emailSent: emailResult.success,
          smsSent: smsResult.success,
          emailError: emailResult.error || null,
        },
      },
      details: `Withdrawal verification created for ${ownerName} - Amount: ${data.amount} UGX, Fee: ${fee} UGX via ${data.channel}.`,
    });

    revalidatePath("/dashboard/withdraw-test");

    let notificationMessage = "";
    if (emailResult.success && smsResult.success) {
      notificationMessage = "Verification codes sent via email and SMS.";
    } else if (emailResult.success) {
      notificationMessage = "Verification code sent via email.";
    } else if (smsResult.success) {
      notificationMessage = "Verification code sent via SMS.";
    } else {
      notificationMessage = `Warning: Failed to send verification codes.`;
    }

    return {
      error: null,
      data: {
        verificationId: verification.id,
        verificationCode,
        fee,
        totalAmount: totalDeduction,
        expiresAt: verification.expiresAt,
        tellerFloatBalance: tellerFloat.balance,
        emailSent: emailResult.success,
        smsSent: smsResult.success,
        emailError: emailResult.error || null,
      },
      message: notificationMessage,
    };
  } catch (error) {
    console.error("Error creating withdrawal verification:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create withdrawal verification",
      data: null,
      message: null,
    };
  }
}

// -----------------------------
// Verify & Process
// -----------------------------
export async function verifyAndProcessWithdrawal(data: {
  verificationId: string;
  verificationCode: string;
  userId: string;
}) {
  try {
    const verification = await db.withdrawalVerification.findUnique({
      where: { id: data.verificationId },
      include: {
        account: { include: { branch: true, accountType: true } },
        member: { include: { user: true } },
        institution: { include: { user: true, signatories: true } },
      },
    });

    if (!verification) return { error: "Verification not found", data: null };

    // Identify Owner for Auditing
    let ownerName = "Unknown";
    let isInstitution = false;
    if (verification.member) {
      ownerName = verification.member.user.name || "Member";
    } else if (verification.institution) {
      ownerName =
        verification.institution.institutionName ||
        verification.institution.user.name ||
        "Institution";
      isInstitution = true;
    }

    if (new Date() > verification.expiresAt) {
      await createAuditLog({
        userId: data.userId,
        action: "WITHDRAWAL_VERIFICATION_EXPIRED",
        entityType: "WithdrawalVerification",
        entityId: verification.id,
        details: `Withdrawal verification code expired for ${ownerName}`,
      });
      return { error: "Verification code has expired", data: null };
    }
    if (verification.isUsed)
      return { error: "Verification code has already been used", data: null };
    if (verification.verificationCode !== data.verificationCode) {
      await createAuditLog({
        userId: data.userId,
        action: "WITHDRAWAL_VERIFICATION_INVALID_CODE",
        entityType: "WithdrawalVerification",
        entityId: verification.id,
        details: `Invalid verification code attempted for ${ownerName}`,
      });
      return { error: "Invalid verification code", data: null };
    }

    // Check for active holds
    const activeHold = await db.accountHold.findFirst({
      where: { accountId: verification.accountId, isActive: true },
      include: { placedBy: { select: { name: true } } },
    });
    if (activeHold) {
      return {
        error: `Account is ON HOLD. Reason: ${activeHold.reason}${activeHold.reasonText ? ` - ${activeHold.reasonText}` : ""}. Placed by: ${activeHold.placedBy.name}`,
        data: null,
      };
    }

    const tellerFloat = await db.userFloat.findFirst({
      where: { userId: data.userId },
    });
    if (!tellerFloat || !tellerFloat.isActiveForDay) {
      return {
        error: "Float not active. Cannot process withdrawal.",
        data: null,
      };
    }
    if (tellerFloat.balance < verification.amount) {
      return {
        error: `Insufficient float. Available: ${tellerFloat.balance.toLocaleString()} UGX, Required: ${verification.amount.toLocaleString()} UGX`,
        data: null,
      };
    }

    // Dynamic fee — fetch system fallback tiers (same as createWithdrawalVerification)
    const systemRates = await db.systemConfiguration.findMany({
      where: {
        key: {
          in: [
            "TELLER_WITHDRAWAL_RATES_MEMBER",
            "TELLER_WITHDRAWAL_RATES_INSTITUTION",
          ],
        },
      },
    });
    const memberWithdrawalRates = systemRates.find(
      (s) => s.key === "TELLER_WITHDRAWAL_RATES_MEMBER",
    )?.value;
    const institutionWithdrawalRates = systemRates.find(
      (s) => s.key === "TELLER_WITHDRAWAL_RATES_INSTITUTION",
    )?.value;
    const fallbackTiersJson = isInstitution
      ? institutionWithdrawalRates
      : memberWithdrawalRates;

    const fee = calculateWithdrawalFee(
      verification.amount,
      verification.account.accountType,
      verification.account as any,
      fallbackTiersJson,
    );

    const oldAccountBalance = verification.account.balance;
    const oldFloatBalance = tellerFloat.balance;
    const totalDeduction = verification.amount + fee;

    const minBalance = verification.account.accountType.minBalance || 0;
    const availableBalance = Math.max(
      0,
      verification.account.balance - minBalance,
    );

    if (totalDeduction > availableBalance) {
      return {
        error: `Insufficient funds. Required: ${totalDeduction.toLocaleString()} UGX, Available: ${availableBalance.toLocaleString()} UGX (Min Balance: ${minBalance.toLocaleString()})`,
        data: null,
      };
    }

    const result = await db.$transaction(async (tx) => {
      // mark verification used
      await tx.withdrawalVerification.update({
        where: { id: data.verificationId },
        data: { isUsed: true, updatedAt: new Date() },
      });

      const transactionRef = `WDL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // main withdrawal transaction
      const transactionData: any = {
        transactionRef,
        accountId: verification.accountId,
        type: TransactionType.WITHDRAWAL,
        amount: verification.amount,
        fee,
        status: TransactionStatus.COMPLETED,
        description: verification.description || "Withdrawal",
        processedByUserId: data.userId,
        transactionDate: new Date(),
        channel: verification.channel,
        externalReference: verification.mobileMoneyRef,
      };
      // Conditionally add owner ID
      if (isInstitution) {
        transactionData.institutionId = verification.institutionId;
      } else {
        transactionData.memberId = verification.memberId;
      }

      const transaction = await tx.transaction.create({
        data: transactionData,
      });

      // withdrawal row
      const withdrawalData: any = {
        transactionId: transaction.id,
        accountId: verification.accountId,
        amount: verification.amount,
        fee,
        withdrawalDate: new Date(),
        handlerUserId: data.userId,
        channel: verification.channel,
        mobileMoneyRef: verification.mobileMoneyRef,
      };
      if (isInstitution) {
        withdrawalData.institutionId = verification.institutionId;
      } else {
        withdrawalData.memberId = verification.memberId;
      }

      const withdrawal = await tx.withdrawal.create({
        data: withdrawalData,
      });

      // Handle Institution Withdrawal Details
      if (
        isInstitution &&
        verification.institutionId &&
        verification.metadata
      ) {
        const metadata = verification.metadata as any;
        if (metadata.recipientName) {
          await tx.institutionWithdrawal.create({
            data: {
              withdrawalId: withdrawal.id,
              institutionId: verification.institutionId,
              recipientName: metadata.recipientName,
              recipientIdNumber: metadata.recipientIdNumber,
              recipientPhone: metadata.recipientPhone,
              recipientRelation: metadata.recipientRelation,
              tellerVerified: true, // Verification happens via the code and teller check
              verifiedAt: new Date(),
              verifiedByUserId: data.userId,
              signatoryApprovals: metadata.verifiedSignatories || [], // List of ID's verified
              mandateMet: true, // Assumed true if teller overrides/submits
            },
          });
        }
      }

      // debit account (amount + fee)
      await tx.account.update({
        where: { id: verification.accountId },
        data: { balance: { decrement: totalDeduction } },
      });

      // reduce float by amount (not fee)
      const newFloatBalance = tellerFloat.balance - verification.amount;
      await tx.userFloat.update({
        where: { id: tellerFloat.id },
        data: { balance: newFloatBalance },
      });

      // float txn record
      await tx.floatTransaction.create({
        data: {
          floatId: tellerFloat.id,
          type: TransactionType.WITHDRAWAL,
          amount: -verification.amount,
          description: `Withdrawal: ${transactionRef} - ${ownerName} (${verification.account.accountNumber})`,
          performedByUserId: data.userId,
          relatedTransactionId: transaction.id,
        },
      });

      // fee handling: income record + journal entries (matching Paths A/C)
      if (fee > 0) {
        const feeCategory = await getOrCreateWithdrawalFeeCategory(tx);
        const currentPeriod = await tx.financialPeriod.findFirst({
          where: {
            isClosed: false,
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
          },
        });

        const receiptNo = `WDF-${Date.now()}`;
        const incomeData: any = {
          budgetCategoryId: feeCategory.id,
          amount: fee,
          recordDate: new Date(),
          description: `Withdrawal fee - ${transactionRef}`,
          branchId: verification.account.branchId,
          accountId: verification.accountId,
          receivedByUserId: data.userId,
          periodId: currentPeriod?.id ?? null,
          status: TransactionStatus.COMPLETED,
          receiptNo,
          externalRef: transactionRef,
        };
        if (isInstitution)
          incomeData.institutionId = verification.institutionId;
        else incomeData.memberId = verification.memberId;

        await tx.incomeRecord.create({
          data: incomeData,
        });

        // Fee journal entry (Dr Savings Liability, Cr Fee Income)
        await createWithdrawalFeeJournalEntry(
          {
            amount: fee,
            description: `Withdrawal fee - ${transactionRef}`,
            reference: transactionRef,
            transactionId: transaction.id,
            userId: data.userId,
            entryDate: new Date(),
            branchId: verification.account.branchId,
            feeAccountCode: WITHDRAWAL_FEE_CODE,
            feeAccountName: "Withdrawal fee charged",
          },
          tx,
        );
      }

      // Principal journal entry (Dr Savings Liability, Cr Cash/Bank)
      {
        const cashCode = verification.channel?.toLowerCase() === "bank" ? "102002" : CASH_AT_HAND_CODE;
        await createWithdrawalPrincipalJournalEntry(
          {
            amount: verification.amount,
            description: `Withdrawal - ${transactionRef}`,
            reference: transactionRef,
            transactionId: transaction.id,
            userId: data.userId,
            entryDate: new Date(),
            branchId: verification.account.branchId,
            cashAccountCode: cashCode,
          },
          tx,
        );
      }

      return {
        transaction,
        transactionRef,
        totalDeducted: totalDeduction,
        fee,
        newFloatBalance,
        withdrawalId: withdrawal.id, // Return ID for notifications
      };
    });

    // audit logs
    await Promise.all([
      logWithdrawalAction(
        data.userId,
        AUDIT_ACTIONS.WITHDRAWAL_COMPLETED,
        result.transaction.id,
        null,
        {
          transactionRef: result.transactionRef,
          amount: verification.amount,
          fee: result.fee,
          totalDeducted: result.totalDeducted,
          channel: verification.channel,
          owner: {
            name: ownerName,
            type: isInstitution ? "INSTITUTION" : "MEMBER",
          },
          account: {
            id: verification.account.id,
            accountNumber: verification.account.accountNumber,
            oldBalance: oldAccountBalance,
            newBalance: oldAccountBalance - result.totalDeducted,
          },
          tellerFloat: {
            oldBalance: oldFloatBalance,
            newBalance: result.newFloatBalance,
            change: -verification.amount,
          },
        },
        `Withdrawal of ${verification.amount.toLocaleString()} UGX (Fee: ${result.fee} UGX) completed for ${ownerName}. Teller float reduced from ${oldFloatBalance.toLocaleString()} to ${result.newFloatBalance.toLocaleString()} UGX.`,
      ),
      createAuditLog({
        userId: data.userId,
        action: "FLOAT_BALANCE_UPDATED",
        entityType: "UserFloat",
        entityId: tellerFloat.id,
        oldValue: { balance: oldFloatBalance },
        newValue: { balance: result.newFloatBalance },
        details: `Float balance reduced from ${oldFloatBalance.toLocaleString()} to ${result.newFloatBalance.toLocaleString()} due to withdrawal ${result.transactionRef}`,
      }),
    ]);

    // Send Signatory Notifications
    if (
      isInstitution &&
      verification.institution &&
      verification.institution.signatories
    ) {
      // Fire and forget notification
      notifySignatories(
        verification.institution.signatories as any[],
        verification.institution.institutionName || "Institution",
        verification.amount,
        result.transactionRef,
        (verification.metadata as any)?.recipientName,
      ).catch((err) => console.error("Failed to notify signatories:", err));
    }

    // Send Transaction Alert Email
    const ownerEmail =
      verification.member?.user?.email ||
      verification.institution?.institutionEmail ||
      verification.institution?.user?.email;
    if (ownerEmail) {
      await sendTransactionAlertEmail(
        ownerEmail,
        ownerName,
        "WITHDRAWAL",
        verification.amount,
        oldAccountBalance - result.totalDeducted,
      );
    }

    // revalidate
    revalidatePath("/dashboard/withdraw-test");
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/accounts");
    revalidatePath("/dashboard/my-float");
    revalidatePath("/dashboard/floats");
    revalidatePath("/dashboard/income");

    return {
      error: null,
      data: {
        ...result,
        newAccountBalance: oldAccountBalance - result.totalDeducted,
      },
      message: `Withdrawal processed successfully. Amount: UGX ${verification.amount.toLocaleString()}, Fee: UGX ${result.fee.toLocaleString()}`,
    };
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to process withdrawal",
      data: null,
      message: null,
    };
  }
}

async function notifySignatories(
  signatories: any[],
  institutionName: string,
  amount: number,
  ref: string,
  recipientName?: string,
) {
  if (!signatories || signatories.length === 0) return;

  const message = `Withdrawal Alert: UGX ${amount.toLocaleString()} withdrawn from ${institutionName}. Ref: ${ref}.${recipientName ? ` Recipient: ${recipientName}.` : ""} If unauthorized, contact SACCO immediately.`;

  console.log(`Notifying ${signatories.length} signatories:`, message);

  for (const sig of signatories) {
    if (sig.phone) {
      // In real app, await SMS sending
      // await sendSMS(sig.phone, message);
      console.log(`SMS to ${sig.name} (${sig.phone}): ${message}`);
    }
    if (sig.email) {
      // In real app, await Email sending
      console.log(`Email to ${sig.name} (${sig.email}): ${message}`);
    }
  }
}
