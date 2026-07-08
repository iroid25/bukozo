import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;

    const loanFilter: any = {
      status: { in: ["DISBURSED", "OVERDUE"] },
      outstandingBalance: { gt: 0 },
    };

    if (["ACCOUNTANT", "TELLER", "AGENT"].includes(user.role)) {
      if (!user.branchId) return NextResponse.json({ error: "No branch assigned" }, { status: 400 });
      loanFilter.branchId = user.branchId;
    }

    const members = await db.member.findMany({
      where: { isApproved: true, loans: { some: loanFilter } },
      select: {
        id: true,
        memberNumber: true,
        user: { select: { id: true, name: true, email: true, phone: true, image: true } },
        loans: {
          where: loanFilter,
          select: {
            id: true, amountGranted: true, outstandingBalance: true, dueDate: true,
            loanApplication: { select: { loanProduct: { select: { name: true } } } },
          },
        },
      },
      orderBy: { memberNumber: "asc" },
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error("Error fetching members with active loans:", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}
