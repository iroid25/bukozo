import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["LOANOFFICER", "BRANCHMANAGER", "ADMIN", "ACCOUNTANT", "TELLER", "AGENT"];

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [loans, institutionLoans, requests] = await Promise.all([
      db.loan.findMany({
        where: {
          status: { in: ["DISBURSED", "OVERDUE"] },
          outstandingBalance: { gt: 0 },
        },
        include: {
          member: {
            include: {
              user: true,
              accounts: { where: { status: "ACTIVE" }, include: { accountType: true } },
            },
          },
          loanApplication: { include: { loanProduct: true } },
          branch: true,
          schedules: {
            where: { status: { in: ["PENDING", "PARTIAL"] } },
            orderBy: { period: "asc" },
          },
        },
        orderBy: { disbursementDate: "desc" },
      }),
      db.institutionLoan.findMany({
        where: {
          status: { in: ["DISBURSED", "OVERDUE"] },
          outstandingBalance: { gt: 0 },
        },
        include: {
          institution: {
            include: {
              user: true,
              accounts: { where: { status: "ACTIVE" }, include: { accountType: true } },
            },
          },
          application: { include: { loanProduct: true } },
          schedules: {
            where: { status: { in: ["PENDING", "PARTIAL"] } },
            orderBy: { period: "asc" },
          },
        },
        orderBy: { disbursementDate: "desc" },
      }),
      db.loanRepaymentRequest.findMany({
        where: {
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          loan: {
            include: {
              member: { include: { user: true } },
              loanApplication: { include: { loanProduct: true } },
            },
          },
          institutionLoan: {
            include: {
              institution: { include: { user: true } },
              application: { include: { loanProduct: true } },
            },
          },
          account: true,
          requestedBy: true,
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const normalizedInstitutionLoans = institutionLoans.map((il: any) => ({
      ...il,
      isInstitution: true,
      member: {
        user: {
          name: il.institution.institutionName,
          email: il.institution.institutionEmail ?? "",
          phone: il.institution.institutionPhone ?? "",
        },
        memberNumber: il.institution.institutionNumber,
        accounts: il.institution.accounts,
      },
      loanApplication: {
        loanProduct: il.application.loanProduct,
        purpose: il.application.purpose,
      },
    }));

    const activeLoans = [...loans, ...normalizedInstitutionLoans];

    const pendingRequests = requests.map((req: any) => {
      if (req.institutionLoan) {
        return {
          ...req,
          loan: {
            ...req.institutionLoan,
            isInstitution: true,
            member: {
              user: {
                name: req.institutionLoan.institution.institutionName,
                email: req.institutionLoan.institution.institutionEmail ?? "",
              },
              memberNumber: req.institutionLoan.institution.institutionNumber,
            },
            loanApplication: {
              loanProduct: req.institutionLoan.application.loanProduct,
            },
          },
        };
      }
      return req;
    });

    return NextResponse.json({ success: true, data: { activeLoans, pendingRequests } });
  } catch (error: any) {
    console.error("Error fetching repayment queue:", error);
    return NextResponse.json({ error: "Failed to fetch repayment queue" }, { status: 500 });
  }
}
