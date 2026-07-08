"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { startOfDay, endOfDay } from "date-fns";

export async function getDataEntrantDashboardData() {
  try {
    const user = await getAuthUser();
    if (!user || user.role !== "DATA_ENTRANT") {
      return { error: "Unauthorized or not a data entrant" };
    }

    const branchId = user.branchId;
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Total Members (scoped to branch via user relationship)
    const totalMembers = await db.member.count({
      where: branchId ? { user: { branchId } } : undefined,
    });

    // 2. Members registered today
    const membersRegisteredToday = await db.member.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
        ...(branchId ? { user: { branchId } } : {}),
      },
    });

    // 3. Total accounts (scoped to branch)
    const totalAccounts = await db.account.count({
      where: branchId ? { branchId } : undefined,
    });

    // 4. Recent Members (last 20)
    const recentMembers = await db.member.findMany({
      where: branchId ? { user: { branchId } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            branch: { select: { name: true } },
          },
        },
        accounts: {
          select: { accountNumber: true, balance: true, status: true },
          take: 3,
        },
      },
    });

    // 5. Total institutions
    const totalInstitutions = await db.institution.count();

    // 6. Institutions registered today
    const institutionsRegisteredToday = await db.institution.count({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
    });

    // 7. Pending member approvals
    const pendingApprovals = await db.member.count({
      where: {
        status: "PENDING_APPROVAL",
        ...(branchId ? { user: { branchId } } : {}),
      },
    });

    return {
      success: true,
      data: {
        user: {
          name: user.name,
          role: user.role,
          image: user.image,
          branchId: user.branchId,
        },
        stats: {
          totalMembers,
          membersRegisteredToday,
          totalAccounts,
          totalInstitutions,
          institutionsRegisteredToday,
          pendingApprovals,
        },
        recentMembers,
      },
    };
  } catch (error) {
    console.error("Error fetching data entrant dashboard data:", error);
    return { error: "Failed to fetch dashboard data" };
  }
}
