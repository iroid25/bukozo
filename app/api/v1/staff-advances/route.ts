import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

const OFFICIAL_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.BRANCHMANAGER,
  UserRole.ACCOUNTANT,
  UserRole.LOANOFFICER,
  UserRole.AUDITOR,
];

const VALID_ADVANCE_TYPES = ["STAFF", "OFFICIAL", "MEMBER"] as const;
type AdvanceType = (typeof VALID_ADVANCE_TYPES)[number];

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.ACCOUNTANT ||
      user.role === UserRole.BRANCHMANAGER;
    const isTeller = user.role === UserRole.TELLER;

    if (!canManage && !isTeller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const status = params.get("status") || undefined;
    const branchId = params.get("branchId") || undefined;
    const advanceType = params.get("advanceType") || undefined;

    const rows = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT * FROM "StaffAdvanceRequest"
      WHERE 1 = 1
      ${
        isTeller
          ? Prisma.sql`AND "initiatedByUserId" = ${user.id}`
          : user.role !== UserRole.ADMIN && user.branchId
            ? Prisma.sql`AND "branchId" = ${user.branchId}`
            : Prisma.empty
      }
      ${user.role === UserRole.ADMIN && branchId && branchId !== "all" ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
      ${status ? Prisma.sql`AND "status" = ${status}::text` : Prisma.empty}
      ${advanceType ? Prisma.sql`AND "advanceType" = ${advanceType}::"AdvanceType"` : Prisma.empty}
      ORDER BY "createdAt" DESC
    `);

    const userIds = Array.from(
      new Set(
        rows
          .flatMap((r) => [r.staffId, r.approvedById, r.rejectedById, r.initiatedByUserId])
          .filter(Boolean),
      ),
    );
    const branchIds = Array.from(new Set(rows.map((r) => r.branchId).filter(Boolean)));

    const [users, branches] = await Promise.all([
      userIds.length > 0
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              role: true,
              branchId: true,
            },
          })
        : [],
      branchIds.length > 0
        ? db.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));

    const data = rows.map((r) => ({
      ...r,
      staff: userMap.get(r.staffId) || null,
      initiatedBy: userMap.get(r.initiatedByUserId) || null,
      approvedBy: r.approvedById ? userMap.get(r.approvedById) || null : null,
      rejectedBy: r.rejectedById ? userMap.get(r.rejectedById) || null : null,
      branch: r.branchId ? branchMap.get(r.branchId) || null : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching advances:", error);
    return NextResponse.json(
      { error: "Failed to fetch advances", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canCreate =
      user.role === UserRole.TELLER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.ACCOUNTANT ||
      user.role === UserRole.BRANCHMANAGER;

    if (!canCreate) {
      return NextResponse.json(
        { error: "You do not have permission to submit advance requests." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const advanceType: AdvanceType = VALID_ADVANCE_TYPES.includes(body.advanceType)
      ? body.advanceType
      : "STAFF";
    const recipientId = String(body.staffId || "").trim();
    const amount = Number(body.amount || 0);
    const reason = String(body.reason || "").trim();
    const installments = Number(body.installments || 1);
    const repaymentStartMonth = String(body.repaymentStartMonth || "").trim();
    const notes = String(body.notes || "").trim();

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient is required." },
        { status: 400 },
      );
    }
    if (!reason || !repaymentStartMonth) {
      return NextResponse.json(
        { error: "Reason and repayment start month are required." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero." }, { status: 400 });
    }
    if (!Number.isInteger(installments) || installments < 1) {
      return NextResponse.json({ error: "Installments must be at least 1." }, { status: 400 });
    }

    // ── Resolve recipient based on advance type ──────────────────────────────
    let recipientName = "";
    let recipientBranchId: string | null = null;

    if (advanceType === "MEMBER") {
      // recipientId is the User.id of a MEMBER-role user
      // OR the Member.id — try both
      let memberUser = await db.user.findFirst({
        where: { id: recipientId, role: UserRole.MEMBER },
        select: { id: true, name: true, role: true, branchId: true },
      });

      // Fallback: recipientId might be a Member model ID
      if (!memberUser) {
        const memberRecord = await db.member.findUnique({
          where: { id: recipientId },
          include: {
            user: { select: { id: true, name: true, role: true, branchId: true } },
          },
        });
        if (memberRecord?.user) {
          memberUser = memberRecord.user;
        }
      }

      if (!memberUser) {
        return NextResponse.json(
          { error: "Selected member not found." },
          { status: 404 },
        );
      }
      recipientName = memberUser.name;
      recipientBranchId = memberUser.branchId || null;

      // Branch restriction for teller
      if (user.role === UserRole.TELLER && user.branchId && recipientBranchId !== user.branchId) {
        return NextResponse.json(
          { error: "You can only initiate advances for members in your branch." },
          { status: 403 },
        );
      }
    } else if (advanceType === "OFFICIAL") {
      const officialUser = await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, role: true, branchId: true },
      });

      if (!officialUser || !OFFICIAL_ROLES.includes(officialUser.role as any)) {
        return NextResponse.json(
          { error: "Selected official not found or does not have an executive role." },
          { status: 404 },
        );
      }
      recipientName = officialUser.name;
      recipientBranchId = officialUser.branchId || null;

      // Only ADMIN, ACCOUNTANT, BRANCHMANAGER can initiate official advances
      if (user.role === UserRole.TELLER) {
        return NextResponse.json(
          { error: "Only managers, accountants, and admins can initiate official advances." },
          { status: 403 },
        );
      }
    } else {
      // STAFF
      const staffUser = await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, role: true, branchId: true },
      });

      if (!staffUser || staffUser.role === UserRole.MEMBER) {
        return NextResponse.json(
          { error: "Selected staff member not found." },
          { status: 404 },
        );
      }
      recipientName = staffUser.name;
      recipientBranchId = staffUser.branchId || null;

      // Teller: must be same branch
      if (user.role === UserRole.TELLER && user.branchId && recipientBranchId !== user.branchId) {
        return NextResponse.json(
          { error: "You can only initiate advances for staff in your branch." },
          { status: 403 },
        );
      }
    }

    // ── Float validation for tellers (applies to all advance types) ──────────
    if (user.role === UserRole.TELLER) {
      if (!user.branchId) {
        return NextResponse.json(
          { error: "Your account is not assigned to a branch." },
          { status: 400 },
        );
      }
      const userFloat = await db.userFloat.findUnique({ where: { userId: user.id } });
      if (!userFloat) {
        return NextResponse.json(
          { error: "You do not have an active float account." },
          { status: 400 },
        );
      }
      if (!userFloat.isActiveForDay) {
        return NextResponse.json(
          { error: "Your float session is not active for today." },
          { status: 400 },
        );
      }
      if (userFloat.balance < amount) {
        return NextResponse.json(
          {
            error: `Insufficient float balance. Available: ${userFloat.balance.toLocaleString()}, Required: ${amount.toLocaleString()}.`,
          },
          { status: 400 },
        );
      }
    }

    const branchId =
      user.role === UserRole.ADMIN
        ? String(body.branchId || recipientBranchId || "").trim()
        : user.branchId || recipientBranchId || "";

    const monthlyDeduction = Number((amount / installments).toFixed(2));

    const countRows = await db.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "StaffAdvanceRequest"`,
    );
    const requestCode = `ADV-${String(Number(countRows[0]?.count || 0) + 1).padStart(5, "0")}`;

    const created = await db.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO "StaffAdvanceRequest" (
        "id", "requestCode", "advanceType", "staffId", "staffName",
        "initiatedByUserId", "amount", "outstandingBalance", "reason",
        "installments", "monthlyDeduction", "repaymentStartMonth", "notes",
        "status", "branchId", "createdAt", "updatedAt"
      ) VALUES (
        ${crypto.randomUUID()}, ${requestCode},
        ${advanceType}::"AdvanceType",
        ${recipientId}, ${recipientName},
        ${user.id}, ${amount}, ${amount}, ${reason},
        ${installments}, ${monthlyDeduction},
        ${repaymentStartMonth}, ${notes || null}, 'PENDING',
        ${branchId || null}, NOW(), NOW()
      )
      RETURNING *
    `);

    return NextResponse.json({ success: true, data: created[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating advance request:", error);
    return NextResponse.json(
      { error: "Failed to create advance request", details: error.message },
      { status: 500 },
    );
  }
}
