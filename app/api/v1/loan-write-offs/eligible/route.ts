import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const loans = await db.loan.findMany({
      where: { status: { in: ["OVERDUE", "DISBURSED"] }, outstandingBalance: { gt: 0 } },
      include: {
        member: { include: { user: true, accounts: true } },
        loanApplication: { include: { loanProduct: true } },
        repayments: true,
        writeOffs: { where: { status: { in: ["PENDING", "APPROVED"] } } },
      },
      orderBy: { disbursementDate: "desc" },
    });

    return successResponse(loans.filter((l) => l.writeOffs.length === 0));
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}
