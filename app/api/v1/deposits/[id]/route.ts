import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

const depositSelect = {
  id: true,
  transactionId: true,
  memberId: true,
  institutionId: true,
  accountId: true,
  amount: true,
  channel: true,
  mobileMoneyRef: true,
  depositorName: true,
  depositDate: true,
  handlerUserId: true,
  transaction: {
    select: {
      id: true,
      transactionRef: true,
      type: true,
      amount: true,
      status: true,
      description: true,
      currency: true,
      branchId: true,
      notes: true,
    },
  },
  member: {
    select: {
      id: true,
      memberNumber: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  },
  institution: {
    select: {
      id: true,
      institutionNumber: true,
      institutionName: true,
      institutionType: true,
      institutionEmail: true,
      institutionPhone: true,
      primaryContactPerson: true,
      primaryContactPhone: true,
      primaryContactEmail: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
        },
      },
    },
  },
  account: {
    select: {
      id: true,
      accountNumber: true,
      balance: true,
      accountType: {
        select: {
          id: true,
          name: true,
          minBalance: true,
        },
      },
      branch: {
        select: {
          id: true,
          name: true,
          location: true,
        },
      },
    },
  },
  handler: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
};

function mapTransactionToDeposit(tx: any) {
  return {
    id: tx.deposit?.id ?? tx.id,
    transactionId: tx.id,
    memberId: tx.memberId,
    institutionId: tx.institutionId,
    accountId: tx.accountId,
    amount: tx.amount,
    depositDate: tx.transactionDate,
    handlerUserId: tx.processedByUserId,
    channel: tx.channel,
    mobileMoneyRef: tx.deposit?.mobileMoneyRef ?? null,
    depositorName: tx.deposit?.depositorName ?? null,
    institutionName: tx.deposit?.institutionName ?? null,
    transaction: {
      id: tx.id,
      transactionRef: tx.transactionRef,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      currency: tx.currency ?? "UGX",
      branchId: tx.branchId,
      notes: tx.notes,
    },
    member: tx.member
      ? {
          id: tx.member.id,
          memberNumber: tx.member.memberNumber,
          user: tx.member.user,
        }
      : null,
    institution: tx.institution
      ? {
          id: tx.institution.id,
          institutionNumber: tx.institution.institutionNumber,
          institutionName: tx.institution.institutionName,
          institutionType: tx.institution.institutionType,
          institutionEmail: tx.institution.institutionEmail,
          institutionPhone: tx.institution.institutionPhone,
          user: tx.institution.user,
        }
      : null,
    account: {
      id: tx.account.id,
      accountNumber: tx.account.accountNumber,
      balance: tx.account.balance,
      accountType: tx.account.accountType,
      branch: tx.account.branch,
    },
    handler: tx.processedByUser
      ? { id: tx.processedByUser.id, name: tx.processedByUser.name, role: tx.processedByUser.role }
      : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const { id } = await params;

    const deposit = await db.deposit.findUnique({
      where: { id },
      select: depositSelect,
    });

    if (deposit) return successResponse(deposit);

    const tx = await db.transaction.findUnique({
      where: { id },
      include: {
        deposit: true,
        member: {
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
          },
        },
        institution: {
          select: {
            id: true,
            institutionNumber: true,
            institutionName: true,
            institutionType: true,
            institutionEmail: true,
            institutionPhone: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                image: true,
              },
            },
          },
        },
        account: {
          include: {
            accountType: true,
            branch: true,
          },
        },
        processedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!tx) return ApiErrors.notFound("Deposit");

    return successResponse(mapTransactionToDeposit(tx));
  } catch (error: any) {
    console.error("Error fetching deposit:", error);
    return ApiErrors.internalError(error.message);
  }
}
