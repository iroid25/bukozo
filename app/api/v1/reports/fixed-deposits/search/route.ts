import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const deposits = await db.fixedDeposit.findMany({
      where: {
        isReversed: false,
        OR: [
          { accountNumber: { contains: query, mode: "insensitive" } },
          { member: { user: { name: { contains: query, mode: "insensitive" } } } },
          { member: { user: { phone: { contains: query } } } },
          { institution: { institutionName: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        accountNumber: true,
        principalAmount: true,
        maturityAmount: true,
        interestRate: true,
        termMonths: true,
        startDate: true,
        maturityDate: true,
        status: true,
        member: {
          select: { user: { select: { name: true, phone: true } } },
        },
        institution: {
          select: { institutionName: true, user: { select: { name: true, phone: true } } },
        },
        branch: { select: { name: true } },
      },
      take: 20,
      orderBy: { accountNumber: "asc" },
    });

    const formatted = deposits.map((fd) => ({
      id: fd.id,
      accountNumber: fd.accountNumber,
      memberName: fd.member?.user?.name || fd.institution?.institutionName || "Unknown",
      memberPhone: fd.member?.user?.phone || fd.institution?.user?.phone || "",
      principalAmount: fd.principalAmount,
      maturityAmount: fd.maturityAmount,
      interestRate: fd.interestRate,
      termMonths: fd.termMonths,
      startDate: fd.startDate.toISOString().split("T")[0],
      maturityDate: fd.maturityDate.toISOString().split("T")[0],
      status: fd.status,
      branch: fd.branch?.name || "N/A",
    }));

    return NextResponse.json({ data: formatted });
  } catch (error) {
    console.error("FD search error:", error);
    return NextResponse.json({ error: "Failed to search fixed deposits" }, { status: 500 });
  }
}
