import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { createAuditLog } from "@/lib/lib/auditLog";
import { z } from "zod";

const liftSchema = z.object({
  liftNotes: z.string().optional(),
});

// PATCH /api/v1/holds/[id]/lift — lift an account hold
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const userId = (session.user as any).id;

    const body = await request.json().catch(() => ({}));
    const { liftNotes } = liftSchema.parse(body);

    const hold = await db.accountHold.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!hold) return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    if (!hold.isActive) return NextResponse.json({ error: "Hold is already lifted" }, { status: 409 });

    const updated = await db.accountHold.update({
      where: { id },
      data: {
        isActive: false,
        liftedAt: new Date(),
        liftedByUserId: userId,
        liftNotes,
      },
    });

    await createAuditLog({
      userId,
      action: "ACCOUNT_HOLD_LIFTED",
      entityType: "AccountHold",
      entityId: id,
      details: `Lifted hold on account ${hold.account.accountNumber}. Notes: ${liftNotes || "None"}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error lifting hold:", error);
    return NextResponse.json({ error: "Failed to lift account hold" }, { status: 500 });
  }
}
