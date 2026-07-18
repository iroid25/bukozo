import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const officerUserId = (session.user as any).id;

    const [memberApps, institutionApps] = await Promise.all([
      db.loanApplication.findMany({
        where: {
          applicantId: officerUserId,
          stage: { in: ["SUBMITTED", "IN_ANALYSIS", "FORWARDED_TO_MANAGER"] },
        },
        orderBy: { applicationDate: "desc" },
        include: { member: { include: { user: true } }, loanProduct: true },
      }),
      db.institutionLoanApplication.findMany({
        where: {
          OR: [
            { loanOfficerId: officerUserId },
            { applicantUserId: officerUserId },
          ],
          stage: { in: ["SUBMITTED", "IN_ANALYSIS", "FORWARDED_TO_MANAGER"] },
        },
        orderBy: { applicationDate: "desc" },
        include: {
          institution: {
            include: { user: true },
          },
          loanProduct: true,
        },
      }),
    ]);

    const normalizedInstitutionApps = institutionApps.map((app) => ({
      ...app,
      isInstitution: true,
      member: {
        id: app.institutionId,
        memberNumber: app.institution.institutionNumber,
        user: {
          name: app.institution.institutionName,
          email: app.institution.user?.email,
          phone: app.institution.user?.phone,
        },
      },
    }));

    const allApps = [...memberApps, ...normalizedInstitutionApps].sort(
      (a, b) => new Date(b.applicationDate).getTime() - new Date(a.applicationDate).getTime()
    );

    return NextResponse.json({ success: true, data: allApps });
  } catch (error) {
    console.error("Error fetching officer queue:", error);
    return NextResponse.json({ error: "Failed to fetch officer queue" }, { status: 500 });
  }
}
