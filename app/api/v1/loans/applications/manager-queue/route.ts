import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [memberApps, institutionApps] = await Promise.all([
      db.loanApplication.findMany({
        where: { stage: "FORWARDED_TO_MANAGER" },
        orderBy: { forwardedAt: "desc" },
        include: { member: { include: { user: true } }, loanProduct: true },
      }),
      db.institutionLoanApplication.findMany({
        where: { stage: "FORWARDED_TO_MANAGER" },
        orderBy: { createdAt: "desc" },
        include: { institution: true, loanProduct: true },
      }),
    ]);

    const combined = [
      ...memberApps.map((a) => ({ ...a, isInstitution: false })),
      ...institutionApps.map((a) => ({
        ...a,
        isInstitution: true,
        // Normalise shape so the UI can use the same fields
        member: {
          user: {
            name: a.institution?.institutionName ?? "Unknown Institution",
            email: a.institution?.institutionEmail ?? null,
            phone: null,
          },
          memberNumber: a.institution?.institutionNumber ?? "",
        },
      })),
    ].sort((a, b) => {
      const dateA = (a as any).forwardedAt ?? (a as any).createdAt ?? new Date(0);
      const dateB = (b as any).forwardedAt ?? (b as any).createdAt ?? new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return NextResponse.json({ success: true, data: combined });
  } catch (error) {
    console.error("Error fetching manager queue:", error);
    return NextResponse.json({ error: "Failed to fetch manager queue" }, { status: 500 });
  }
}
