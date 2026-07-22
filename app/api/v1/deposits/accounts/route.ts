import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");
    const institutionId = searchParams.get("institutionId");

    if (!memberId && !institutionId) {
      return NextResponse.json({ error: "Member ID or Institution ID is required" }, { status: 400 });
    }

    const branchId = user.role !== UserRole.ADMIN && user.branchId ? user.branchId : undefined;


    const accounts = await db.account.findMany({
      where: {
        status: "ACTIVE",
        ...(memberId && { memberId }),
        ...(institutionId && { institutionId }),
        ...(branchId && { branchId }),
      },
      include: {
        accountType: {
          select: {
            name: true,
            isShareAccount: true,
            canWithdraw: true,
          },
        },
        jointMembers: {
          select: {
            id: true,
            memberId: true,
            member: {
              select: {
                id: true,
                memberNumber: true,
                applicantSignature: true,
                passportPhoto: true,
                fingerprintTemplate: true,
                user: { select: { name: true, image: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: {
        accountNumber: "asc",
      },
    });

    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error("Error fetching accounts API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
