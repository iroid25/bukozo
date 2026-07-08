import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { UserRole } from "@prisma/client";
import { successResponse } from "@/lib/api-utils";
import { ExpenditureService } from "@/services/expenditure.service";

type AppUser = { id: string; role: string; branchId: string | null };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as AppUser;
    const { id } = await params;
    const body = await request.json();

    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BRANCHMANAGER];
    if (!allowedRoles.includes(user.role as UserRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { status, rejectionReason } = body;
    if (!["COMPLETED", "FAILED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await ExpenditureService.approveExpenditure(id, { status, rejectionReason }, user);

    return successResponse(result, `Expenditure ${status === "COMPLETED" ? "approved" : "rejected"} successfully`);
  } catch (error: any) {
    console.error("Error approving expenditure:", error);
    return NextResponse.json({ error: error.message || "Failed to process expenditure" }, { status: 500 });
  }
}
