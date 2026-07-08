import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

function buildDayBounds(activeDayStart?: string | Date | null) {
  const dateFloor = activeDayStart ? new Date(activeDayStart) : new Date();
  dateFloor.setHours(0, 0, 0, 0);
  const dateCeil = new Date(dateFloor);
  dateCeil.setHours(23, 59, 59, 999);
  return { dateFloor, dateCeil };
}

async function getTellerCashActivity(
  userId: string,
  activeDayStart?: string | Date | null,
) {
  const { dateFloor, dateCeil } = buildDayBounds(activeDayStart);

  const [
    depositAggregate,
    withdrawalAggregate,
    depositCount,
    withdrawalCount,
    sharePurchaseAggregate,
    sharePurchaseCount,
  ] = await Promise.all([
    db.deposit.aggregate({
      where: {
        handlerUserId: userId,
        depositDate: { gte: dateFloor, lte: dateCeil },
      },
      _sum: { amount: true },
    }),
    db.withdrawal.aggregate({
      where: {
        handlerUserId: userId,
        withdrawalDate: { gte: dateFloor, lte: dateCeil },
      },
      _sum: { amount: true },
    }),
    db.deposit.count({
      where: {
        handlerUserId: userId,
        depositDate: { gte: dateFloor, lte: dateCeil },
      },
    }),
    db.withdrawal.count({
      where: {
        handlerUserId: userId,
        withdrawalDate: { gte: dateFloor, lte: dateCeil },
      },
    }),
    db.floatTransaction.aggregate({
      where: {
        float: { userId },
        type: "SHARES_PURCHASE",
        transactionDate: { gte: dateFloor, lte: dateCeil },
      },
      _sum: { amount: true },
    }),
    db.floatTransaction.count({
      where: {
        float: { userId },
        type: "SHARES_PURCHASE",
        transactionDate: { gte: dateFloor, lte: dateCeil },
      },
    }),
  ]);

  const sharesPurchaseAmount = Number(sharePurchaseAggregate._sum?.amount || 0);

  return {
    totalDeposits: Number(depositAggregate._sum?.amount || 0) + sharesPurchaseAmount,
    totalWithdrawals: Number(withdrawalAggregate._sum?.amount || 0),
    depositCount: depositCount + sharePurchaseCount,
    withdrawalCount,
    date: dateFloor,
  };
}

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const allowedRoles = ["TELLER", "AGENT", "BRANCHMANAGER"];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const currentUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branch: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (user.role === "BRANCHMANAGER") {
      const vault = await db.vault.findFirst({
        where: { branchId: user.branchId },
        include: {
          vaultTransactions: {
            orderBy: { transactionDate: "desc" },
            take: 20,
            include: {
              performedBy: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      const mappedVaultFloat = vault
        ? {
            id: vault.id,
            balance: vault.balance,
            userId: user.id,
            isActiveForDay: true,
            canStartNewDay: false,
            currentDayStarted: new Date().toISOString(),
            pendingReconciliation: false,
            lastReconciliation: new Date(),
          }
        : null;

      const mappedTransactions =
        vault?.vaultTransactions.map((transaction) => ({
          id: transaction.id,
          transactionDate: transaction.transactionDate,
          type:
            transaction.type === "VAULT_TRANSFER" && transaction.amount > 0
              ? "FLOAT_ALLOCATION"
              : "DEPOSIT",
          amount: transaction.amount,
          description: transaction.description,
          performedByUser: transaction.performedBy,
        })) || [];

      return NextResponse.json({
        success: true,
        data: {
          userFloat: mappedVaultFloat,
          floatTransactions: mappedTransactions,
          floatReconciliations: [],
          currentUser,
          cashActivity: {
            totalDeposits: 0,
            totalWithdrawals: 0,
            depositCount: 0,
            withdrawalCount: 0,
            date: new Date(),
          },
        },
      });
    }

    const userFloat = await db.userFloat.findFirst({
      where: { userId: user.id },
      include: {
        user: {
          include: {
            branch: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
          },
        },
      },
    });

    if (!userFloat) {
      return NextResponse.json({
        success: true,
        data: {
          userFloat: null,
          floatTransactions: [],
          floatReconciliations: [],
          currentUser,
          cashActivity: {
            totalDeposits: 0,
            totalWithdrawals: 0,
            depositCount: 0,
            withdrawalCount: 0,
            date: new Date(),
          },
        },
      });
    }

    const [floatTransactions, floatReconciliations, cashActivity] =
      await Promise.all([
        db.floatTransaction.findMany({
          where: { floatId: userFloat.id },
          include: {
            float: {
              include: {
                user: {
                  include: {
                    branch: {
                      select: {
                        id: true,
                        name: true,
                        location: true,
                      },
                    },
                  },
                },
              },
            },
            performedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { transactionDate: "desc" },
        }),
        db.floatReconciliation.findMany({
          where: { floatId: userFloat.id },
          include: {
            float: {
              include: {
                user: {
                  include: {
                    branch: {
                      select: {
                        id: true,
                        name: true,
                        location: true,
                      },
                    },
                  },
                },
              },
            },
            reconciledByUser: {
              select: {
                id: true,
                name: true,
                role: true,
                email: true,
                phone: true,
              },
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
                role: true,
                email: true,
              },
            },
          },
          orderBy: { reconciliationDate: "desc" },
        }),
        getTellerCashActivity(
          user.id,
          userFloat.currentDayStarted || undefined,
        ),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        userFloat,
        floatTransactions,
        floatReconciliations,
        currentUser,
        cashActivity,
      },
    });
  } catch (error) {
    console.error("Error fetching my float data:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load my float data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
