import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { getFloatOpeningBalanceSource } from "@/lib/float-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "BRANCHMANAGER", "TELLER", "AGENT"].includes(currentUser.role)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const { userId } = await props.params;
    const userFloat = await db.userFloat.findFirst({
      where: { userId },
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
      return NextResponse.json(
        { success: false, error: "User float not found" },
        { status: 404 }
      );
    }

    const [floatTransactions, floatReconciliations, openingBalanceSource] =
      await Promise.all([
        db.floatTransaction.findMany({
          where: { floatId: userFloat.id },
          include: {
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
        getFloatOpeningBalanceSource(userFloat.id),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        userFloat,
        openingBalance: openingBalanceSource?.balance ?? userFloat.balance,
        openingBalanceSource,
        floatTransactions: floatTransactions || [],
        floatReconciliations: floatReconciliations || [],
        currentUserId: currentUser.id,
        currentUserRole: currentUser.role,
      },
    });
  } catch (error) {
    console.error("Error fetching float user detail:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
