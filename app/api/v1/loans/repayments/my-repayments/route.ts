import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only members can access this endpoint
    if (session.user.role !== "MEMBER") {
      return NextResponse.json(
        { error: "Only members can view their repayments" },
        { status: 403 }
      );
    }

    // Retrieve the member record
    const member = await db.member.findUnique({
      where: { userId: session.user.id },
    });

    if (!member) {
      return NextResponse.json({
        data: [],
        pagination: { total: 0, page: 1, limit: 50, totalPages: 0 },
      });
    }

    // Pagination params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const [repayments, total] = await Promise.all([
      db.loanRepayment.findMany({
        where: { memberId: member.id },
        skip,
        take: limit,
        orderBy: { repaymentDate: "desc" },
        include: {
          loan: {
            include: {
              loanApplication: {
                include: {
                  loanProduct: true,
                },
              },
              branch: true,
            },
          },
          handler: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              image: true,
            },
          },
        },
      }),

      db.loanRepayment.count({ where: { memberId: member.id } }),
    ]);

    return NextResponse.json({
      data: repayments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching member repayments:", error);
    return NextResponse.json(
      { error: "Failed to fetch repayments" },
      { status: 500 }
    );
  }
}
