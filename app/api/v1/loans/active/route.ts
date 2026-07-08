// app/api/v1/loans/active/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

/**
 * GET /api/v1/loans/active
 * Fetch all active loans (Individual and Institution) with account details and schedules.
 * This consolidated endpoint replaces the old /api/active-loans.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - Please log in" },
        { status: 401 }
      );
    }

    const allowedRoles = [
      "ADMIN",
      "BRANCHMANAGER",
      "TELLER",
      "LOANOFFICER",
      "ACCOUNTANT",
      "AUDITOR",
      "AGENT",
    ];

    if (!allowedRoles.includes(user.role) && user.role !== "MEMBER") {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to view active loans",
        },
        { status: 403 }
      );
    }

    // Individual Loans Condition
    let individualWhereCondition: any = {
      status: {
        in: ["DISBURSED", "OVERDUE"],
      },
      outstandingBalance: {
        gt: 0,
      },
    };

    if (user.role === "MEMBER") {
      const member = await db.member.findUnique({
        where: { userId: user.id },
      });
      if (!member) {
        return NextResponse.json({ success: false, error: "Member record not found" }, { status: 404 });
      }
      individualWhereCondition.memberId = member.id;
    } else if (["BRANCHMANAGER", "TELLER", "LOANOFFICER", "ACCOUNTANT"].includes(user.role) && user.branchId) {
      individualWhereCondition.branchId = user.branchId;
    }

    // Fetch active individual loans
    const activeIndividualLoans = await db.loan.findMany({
      where: individualWhereCondition,
      include: {
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
            accounts: {
              where: { status: "ACTIVE" },
              select: {
                id: true,
                accountNumber: true,
                balance: true,
                accountType: {
                  select: { name: true, isShareAccount: true }
                }
              }
            }
          },
        },
        loanApplication: {
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                interestType: true,
                interestPeriod: true,
              },
            },
          },
        },
        branch: {
          select: { id: true, name: true },
        },
        // ADDED: Schedules for Phase 14 splitting logic
        schedules: {
            where: {
                status: { in: ["PENDING", "PARTIAL"] }
            },
            orderBy: { period: "asc" }
        }
      },
      orderBy: [
        { status: "asc" }, // OVERDUE first
        { dueDate: "asc" },
      ],
    });

    // Institution Loans Condition
    let institutionWhereCondition: any = {
      status: {
        in: ["DISBURSED", "OVERDUE"],
      },
      outstandingBalance: {
        gt: 0,
      },
    };

    // Filter by branch for Branch Staff
    if (["BRANCHMANAGER", "TELLER", "LOANOFFICER", "ACCOUNTANT"].includes(user.role) && user.branchId) {
        institutionWhereCondition.institution = {
            user: {
                branchId: user.branchId
            }
        };
    }

    const activeInstitutionLoans = await db.institutionLoan.findMany({
      where: institutionWhereCondition,
      include: {
        institution: {
          select: {
            id: true,
            institutionName: true,
            institutionEmail: true,
            institutionPhone: true,
            institutionNumber: true,
            accounts: {
                where: { status: "ACTIVE" },
                select: {
                    id: true,
                    accountNumber: true,
                    balance: true,
                    accountType: { select: { name: true, isShareAccount: true } }
                }
            }
          }
        },
        application: {
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                interestRate: true,
                interestType: true,
                interestPeriod: true,
              },
            },
          },
        },
        // ADDED: Schedules for Institutions (using separate model)
      },
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
      ],
    });

    // We also need the institution schedules. Prisma queryRaws are often used for them in this codebase.
    const instLoanIds = activeInstitutionLoans.map(l => l.id);
    const instSchedules = instLoanIds.length > 0 ? await db.$queryRaw<any[]>`
        SELECT * FROM "InstitutionLoanRepaymentSchedule" 
        WHERE "loanId" IN (${instLoanIds.join(",")}) 
        AND "status" IN ('PENDING', 'PARTIAL')
        ORDER BY "period" ASC
    ` : [];

    // Map institution loans to match the frontend expected structure
    const formattedInstitutionLoans = activeInstitutionLoans.map(loan => {
        const mySchedules = instSchedules.filter(s => (s.loanId || s.loanid) === loan.id);
        return {
            ...loan,
            isInstitution: true,
            member: {
                user: {
                    name: loan.institution.institutionName,
                    email: loan.institution.institutionEmail,
                    phone: loan.institution.institutionPhone,
                },
                memberNumber: loan.institution.institutionNumber || "",
                accounts: loan.institution.accounts,
            },
            loanApplication: loan.application,
            schedules: mySchedules.map(s => ({
                id: s.id,
                period: s.period,
                dueDate: s.dueDate || s.duedate,
                principalPayment: s.principalPayment || s.principal_payment || s.principalpayment,
                interestPayment: s.interestPayment || s.interest_payment || s.interestpayment,
                totalPayment: s.totalPayment || s.total_payment || s.totalpayment,
                paidAmount: s.paidAmount || s.paid_amount || s.paidamount,
                status: s.status
            }))
        };
    });

    // Combine and sort
    const activeLoans = [...activeIndividualLoans, ...formattedInstitutionLoans].sort((a, b) => {
      if (a.status === "OVERDUE" && b.status !== "OVERDUE") return -1;
      if (a.status !== "OVERDUE" && b.status === "OVERDUE") return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return NextResponse.json({
      success: true,
      loans: activeLoans,
      count: activeLoans.length,
    });
  } catch (error) {
    console.error("❌ Error fetching active loans:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch active loans" },
      { status: 500 }
    );
  }
}
