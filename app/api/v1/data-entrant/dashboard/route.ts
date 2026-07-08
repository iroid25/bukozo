import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "DATA_ENTRANT") {
      return NextResponse.json({ success: false, error: "Unauthorized or not a data entrant" }, { status: 403 });
    }

    const branchId = user.branchId;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const [totalMembers, membersRegisteredToday, totalAccounts, totalInstitutions, institutionsRegisteredToday, pendingApprovals, recentMembers] = await Promise.all([
      db.member.count({ where: branchId ? { user: { branchId } } : undefined }),
      db.member.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, ...(branchId ? { user: { branchId } } : {}) } }),
      db.account.count({ where: branchId ? { branchId } : undefined }),
      db.institution.count(),
      db.institution.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      db.member.count({ where: { status: "PENDING_APPROVAL", ...(branchId ? { user: { branchId } } : {}) } }),
      db.member.findMany({
        where: branchId ? { user: { branchId } } : undefined,
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { name: true, email: true, phone: true, branch: { select: { name: true } } } },
          accounts: { select: { accountNumber: true, balance: true, status: true }, take: 3 },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        user: { name: user.name, role: user.role, image: user.image, branchId: user.branchId },
        stats: { totalMembers, membersRegisteredToday, totalAccounts, totalInstitutions, institutionsRegisteredToday, pendingApprovals },
        recentMembers,
      },
    });
  } catch (error: any) {
    console.error("Error fetching data entrant dashboard data:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
