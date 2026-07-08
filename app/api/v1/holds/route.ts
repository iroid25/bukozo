import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { HoldReason } from "@prisma/client";
import { createAuditLog } from "@/lib/lib/auditLog";
import { z } from "zod";

const placeHoldSchema = z.object({
  accountId: z.string().min(1),
  reason: z.nativeEnum(HoldReason),
  reasonText: z.string().optional(),
  loanId: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/v1/holds — list all active holds
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const memberId = searchParams.get("memberId");
    const active = searchParams.get("active");

    const where: any = {};
    if (accountId) where.accountId = accountId;
    if (memberId) where.memberId = memberId;
    if (active !== "all") where.isActive = true;

    const holds = await db.accountHold.findMany({
      where,
      include: {
        account: { include: { accountType: true } },
        member: { include: { user: true } },
        institution: { include: { user: true } },
        placedBy: true,
        liftedBy: true,
        loan: true,
      },
      orderBy: { placedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: holds });
  } catch (error) {
    console.error("Error fetching holds:", error);
    return NextResponse.json({ error: "Failed to fetch holds" }, { status: 500 });
  }
}

// POST /api/v1/holds — place a hold on an account
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const validation = placeHoldSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid data", details: validation.error.errors }, { status: 400 });
    }

    const { accountId, reason, reasonText, loanId, notes } = validation.data;
    const userId = (session.user as any).id;

    const account = await db.account.findUnique({
      where: { id: accountId },
      include: { accountHolds: { where: { isActive: true } } },
    });

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    if (account.accountHolds.length > 0) {
      return NextResponse.json({ error: "Account is already on hold" }, { status: 409 });
    }

    const memberId = account.memberId;
    if (!memberId) {
      return NextResponse.json({ error: "Account must be associated with a member to place a hold" }, { status: 400 });
    }

    const hold = await db.accountHold.create({
      data: {
        accountId,
        memberId,
        institutionId: account.institutionId,
        reason,
        reasonText,
        loanId,
        placedByUserId: userId,
        notes,
        isActive: true,
      },
    });

    await createAuditLog({
      userId,
      action: "ACCOUNT_HOLD_PLACED",
      entityType: "AccountHold",
      entityId: hold.id,
      details: `Placed ${reason} hold on account ${account.accountNumber}. Reason: ${reasonText || "None"}`,
    });

    return NextResponse.json({ success: true, data: hold }, { status: 201 });
  } catch (error) {
    console.error("Error placing hold:", error);
    return NextResponse.json({ error: "Failed to place account hold" }, { status: 500 });
  }
}
