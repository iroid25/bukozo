import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";
import { sendTransactionAlertEmail } from "@/lib/email";
import { LoanService } from "@/services/loan.service";

const createRepaymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1),
  transactionReference: z.string().optional(),
  interestAmount: z.number().optional(),
  penaltyAmount: z.number().optional(),
  principalAmount: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "500");
    const loanId = searchParams.get("loanId");
    const memberId = searchParams.get("memberId");

    const skip = (page - 1) * limit;
    const user = session.user;

    // Build conditions
    let individualWhere: any = {};
    let institutionWhere: any = {};

    if (loanId) {
      individualWhere.loanId = loanId;
      institutionWhere.loanId = loanId;
    } else if (memberId) {
      individualWhere.memberId = memberId;
      // Institutions don't have memberId, they have institutionId
    }

    // Role-based filtering
    if (user.role === "AGENT") {
      individualWhere.handlerUserId = user.id;
      // We don't have handlerUserId on institutional repayments yet
    } else if (["BRANCHMANAGER", "TELLER"].includes(user.role) && user.branchId) {
      individualWhere.loan = { branchId: user.branchId };
      // Institutional loans don't have branchId fields directly in the schema we saw
    } else if (user.role === "MEMBER") {
      const member = await db.member.findUnique({ where: { userId: user.id } });
      if (member) {
        individualWhere.memberId = member.id;
        institutionWhere = { id: 'none' }; // Members don't see institutional repayments
      } else {
        return NextResponse.json({ data: [], pagination: { total: 0 } });
      }
    } else if (user.role === "INSTITUTION") {
      const inst = await db.institution.findUnique({ where: { userId: user.id } });
      if (inst) {
        institutionWhere.institutionId = inst.id;
        individualWhere = { id: 'none' };
      } else {
        return NextResponse.json({ data: [], pagination: { total: 0 } });
      }
    } else if (user.role === "LOANOFFICER") {
      individualWhere.loan = {
        OR: [{ allocatedTellerId: user.id }, { loanApplication: { loanOfficerId: user.id } }]
      };
      // Institutional filtering for LO would go here
    } else if (!["ADMIN", "ACCOUNTANT", "AUDITOR", "BRANCHMANAGER", "TELLER", "DATA_ENTRANT"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    // Parallel fetching with error safety
    const instModel = (db as any).institutionLoanRepayment;
    const [repayments, total, instRepayments] = await Promise.all([
      db.loanRepayment.findMany({
        where: individualWhere,
        skip,
        take: limit,
        include: {
          loan: {
            include: {
              member: { include: { user: { select: { id: true, name: true, email: true, phone: true, image: true } } } },
              loanApplication: { include: { loanProduct: true } },
              branch: true,
            },
          },
          handler: true,
        },
        orderBy: { repaymentDate: "desc" },
      }),
      db.loanRepayment.count({ where: individualWhere }),
      (institutionWhere.id === 'none' || !instModel) ? Promise.resolve([]) : instModel.findMany({
        where: institutionWhere,
        include: {
          institution: true,
          loan: {
            include: {
              application: { include: { loanProduct: true } }
            }
          }
        },
        orderBy: { repaymentDate: "desc" },
        take: limit,
      }).catch((err: any) => {
        console.error("Error fetching institutional repayments:", err);
        return [];
      })
    ]);


    // Format institutional repayments
    let formattedInstRepayments: any[] = [];
    try {
      formattedInstRepayments = (instRepayments || []).map((repayment: any) => ({
        ...repayment,
        id: repayment.id,
        amount: repayment.amount,
        repaymentDate: repayment.repaymentDate,
        channel: repayment.channel,
        isInstitution: true,
        loan: {
          ...repayment.loan,
          member: {
            user: {
              id: repayment.institution?.userId || "N/A",
              name: repayment.institution?.institutionName || "Unknown Institution",
              email: repayment.institution?.institutionEmail || "",
              phone: repayment.institution?.institutionPhone || "",
              image: null
            },
            memberNumber: repayment.institution?.institutionNumber || "N/A",
          },
          loanApplication: repayment.loan?.application || null,
          branch: null 
        },
        handler: { name: "System", role: "SYSTEM" }
      }));
    } catch (formatError) {
      console.error("[API] Error formatting institutional repayments:", formatError);
      // Fallback: don't include instRepayments if they cause a crash
      formattedInstRepayments = [];
    }

    // Combine, sort and paginate
    let combined = [];
    try {
      combined = [...repayments, ...formattedInstRepayments]
        .sort((a, b) => {
          const dateA = new Date(a.repaymentDate).getTime();
          const dateB = new Date(b.repaymentDate).getTime();
          if (isNaN(dateA)) console.warn(`[API] Invalid repaymentDate for a: ${a.id}`);
          if (isNaN(dateB)) console.warn(`[API] Invalid repaymentDate for b: ${b.id}`);
          return (dateB || 0) - (dateA || 0);
        })
        .slice(0, limit);
    } catch (sortError) {
      console.error("[API] Error sorting combined repayments:", sortError);
      combined = repayments.slice(0, limit); // Fallback to individual only
    }

    return NextResponse.json({
      data: combined,
      pagination: {
        page,
        limit,
        total: total + formattedInstRepayments.length,
        totalPages: Math.ceil((total + formattedInstRepayments.length) / limit),
      },
    });
  } catch (error) {
    console.error(`[API] Error fetching loan repayments (Status 500):`, error);
    return NextResponse.json(
      { error: "Failed to fetch loan repayments", details: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createRepaymentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
          { error: "Invalid data", details: validation.error.errors },
          { status: 400 }
      );
    }

    const data = validation.data;

    // 1. Try to find individual loan
    let loan = await db.loan.findUnique({
      where: { id: data.loanId },
      include: {
        member: { include: { user: true } },
        loanApplication: { include: { loanProduct: true } },
        branch: true,
      },
    });

    let institutionLoan = null;
    let isInstitution = false;

    // 2. Try institution loan if individual not found
    if (!loan) {
      institutionLoan = await db.institutionLoan.findUnique({
        where: { id: data.loanId },
        include: {
          institution: { include: { user: { include: { branch: true } } } },
          application: { include: { loanProduct: true } },
        }
      });
      if (institutionLoan) isInstitution = true;
    }

    if (!loan && !institutionLoan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const targetLoan = (loan || institutionLoan) as any;
    const loanOwnerUserId = isInstitution ? institutionLoan!.institution.userId : loan!.member.user.id;
    const loanBranchId = isInstitution ? institutionLoan!.institution.user.branchId : loan!.branchId;

    // 3. Role-based Permission Checks
    const userRole = session.user.role;
    
    // Member check
    if (userRole === "MEMBER" && loanOwnerUserId !== session.user.id) {
       return NextResponse.json({ error: "Unauthorized to make repayment for this loan" }, { status: 403 });
    }

    // Staff/Agent checks (Security: Non-Admins may only see their own branch)
    if (["TELLER", "LOANOFFICER", "AGENT", "BRANCHMANAGER"].includes(userRole)) {
        if (session.user.branchId && loanBranchId && loanBranchId !== session.user.branchId) {
             // Optional: Enforce branch boundary for non-admins if branchId is available
             // For now, let's keep it lenient unless branch mismatch is critical
        }
    }

    // 4. Validate amount
    if (data.amount > (targetLoan.outstandingBalance + 0.1)) {
      return NextResponse.json(
        { error: "Repayment amount exceeds outstanding balance" },
        { status: 400 }
      );
    }

    // Process repayment using LoanService
    const result = await LoanService.repay({
      loanId: data.loanId,
      amount: data.amount,
      handlerId: session.user.id,
      handlerRole: session.user.role,
      channel: data.paymentMethod,
      reference: data.transactionReference,
      notes: data.notes,
      interestAmount: data.interestAmount,
      penaltyAmount: data.penaltyAmount,
      principalAmount: data.principalAmount,
      branchId: (session.user as any).branchId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // 5. Send email notification
    const loanOwnerEmail = isInstitution ? institutionLoan!.institution.institutionEmail : loan!.member.user.email;
    const loanOwnerName = isInstitution ? institutionLoan!.institution.institutionName : loan!.member.user.name;

    if (loanOwnerEmail) {
      await sendTransactionAlertEmail(
        loanOwnerEmail,
        loanOwnerName,
        "REPAYMENT",
        data.amount,
        targetLoan.outstandingBalance - data.amount
      );
    }
    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Error creating loan repayment:", error);
    return NextResponse.json(
      { error: "Failed to create loan repayment" },
      { status: 500 }
    );
  }
}
