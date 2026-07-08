import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const where: any = { approvalStatus: "PENDING" };
    if (user.role === "BRANCHMANAGER" && user.branchId) {
      where.user = { branchId: user.branchId };
    }

    const members = await db.member.findMany({
      where,
      select: {
        id: true,
        memberNumber: true,
        surname: true,
        otherNames: true,
        registrationDate: true,
        occupation: true,
        approvalStatus: true,
        fingerprintTemplate: true,
        user: {
          select: {
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { registrationDate: "desc" },
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    console.error("Error fetching pending members:", error);
    return NextResponse.json({ error: "Failed to fetch pending members" }, { status: 500 });
  }
}
