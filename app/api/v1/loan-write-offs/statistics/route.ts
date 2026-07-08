import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const [pending, approved, rejected, totalAmount] = await Promise.all([
      db.loanWriteOff.count({ where: { status: "PENDING" } }),
      db.loanWriteOff.count({ where: { status: "APPROVED" } }),
      db.loanWriteOff.count({ where: { status: "REJECTED" } }),
      db.loanWriteOff.aggregate({ where: { status: "APPROVED" }, _sum: { totalBalance: true } }),
    ]);

    return successResponse({ pending, approved, rejected, totalAmount: totalAmount._sum.totalBalance || 0 });
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}
