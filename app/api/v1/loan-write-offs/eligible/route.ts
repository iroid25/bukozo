import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const [loans, institutionLoans] = await Promise.all([
      db.loan.findMany({
        where: { status: { in: ["OVERDUE", "DISBURSED"] }, outstandingBalance: { gt: 0 } },
        include: {
          member: { include: { user: true, accounts: true } },
          loanApplication: { include: { loanProduct: true } },
          repayments: true,
          writeOffs: { where: { status: { in: ["PENDING", "APPROVED"] } } },
        },
        orderBy: { disbursementDate: "desc" },
      }),
      db.institutionLoan.findMany({
        where: { status: { in: ["OVERDUE", "DISBURSED"] }, outstandingBalance: { gt: 0 } },
        include: {
          institution: { include: { user: true, accounts: true } },
          application: { include: { loanProduct: true } },
          repayments: true,
          writeOffs: { where: { status: { in: ["PENDING", "APPROVED"] } } },
        },
        orderBy: { disbursementDate: "desc" },
      }),
    ]);

    const eligibleLoans = loans.filter((l) => l.writeOffs.length === 0);
    const eligibleInstitutionLoans = institutionLoans
      .filter((l) => l.writeOffs.length === 0)
      .map((l) => ({ ...l, isInstitution: true }));

    return successResponse([...eligibleLoans, ...eligibleInstitutionLoans]);
  } catch (error: any) {
    return ApiErrors.internalError(error.message);
  }
}
