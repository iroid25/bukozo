import { NextRequest, NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

const TRANSFER_STATUS_PENDING = "PENDING_APPROVAL";

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function toDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get("branchId") || undefined;
    const status = searchParams.get("status") || undefined;

    const transfers = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "AssetTransfer"
      WHERE 1 = 1
      ${user.role !== UserRole.ADMIN && user.branchId ? Prisma.sql`AND "branchId" = ${user.branchId}` : Prisma.empty}
      ${user.role === UserRole.ADMIN && branchId && branchId !== "all" ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
      ${status ? Prisma.sql`AND "status" = ${status}` : Prisma.empty}
      ORDER BY "createdAt" DESC
    `);

    const allAccountIds = Array.from(
      new Set(
        transfers.flatMap((t) => [t.sourceAssetId, t.targetAssetId]).filter(Boolean),
      ),
    );

    const branchIds = Array.from(
      new Set(transfers.map((t) => t.branchId).filter(Boolean)),
    );

    const [accounts, branches, users] = await Promise.all([
      allAccountIds.length > 0
        ? db.chartOfAccount.findMany({
            where: { id: { in: allAccountIds } },
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              balance: true,
              isActive: true,
            },
          })
        : [],
      branchIds.length > 0
        ? db.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true },
          })
        : [],
      transfers.length > 0
        ? db.user.findMany({
            where: {
              id: {
                in: Array.from(
                  new Set(
                    transfers
                      .flatMap((t) => [
                        t.requestedByUserId,
                        t.approvedByUserId,
                        t.rejectedByUserId,
                      ])
                      .filter(Boolean),
                  ),
                ),
              },
            },
            select: { id: true, name: true, firstName: true, lastName: true },
          })
        : [],
    ]);

    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const branchMap = new Map(branches.map((b) => [b.id, b]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichAccount = (a: typeof accounts[0] | undefined) =>
      a ? { ...a, assetCode: a.accountCode, assetName: a.accountName } : null;

    const data = transfers.map((transfer) => ({
      ...transfer,
      branch: transfer.branchId ? branchMap.get(transfer.branchId) || null : null,
      sourceAsset: enrichAccount(accountMap.get(transfer.sourceAssetId)),
      targetAsset: enrichAccount(accountMap.get(transfer.targetAssetId)),
      requestedBy: userMap.get(transfer.requestedByUserId) || null,
      approvedBy: transfer.approvedByUserId
        ? userMap.get(transfer.approvedByUserId) || null
        : null,
      rejectedBy: transfer.rejectedByUserId
        ? userMap.get(transfer.rejectedByUserId) || null
        : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error loading current asset transfers:", error);
    return NextResponse.json(
      { error: "Failed to load current asset transfers", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT &&
      user.role !== UserRole.BRANCHMANAGER
    ) {
      return NextResponse.json(
        { error: "You do not have permission to create asset transfers." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const sourceAssetId = toText(body.sourceAssetId);
    const targetAssetId = toText(body.targetAssetId);
    const branchId = toText(body.branchId) || user.branchId || null;
    const notes = toText(body.notes);
    const receiptNo = toText(body.receiptNo);
    const officerName = toText(body.officerName) || user.name || "";
    const amount = toNumber(body.amount);
    const transferDate = toDate(body.transferDate);

    if (!sourceAssetId || !targetAssetId || !branchId) {
      return NextResponse.json(
        { error: "Source account, target account, and branch are required." },
        { status: 400 },
      );
    }

    if (sourceAssetId === targetAssetId) {
      return NextResponse.json(
        { error: "Source and target accounts must be different." },
        { status: 400 },
      );
    }

    if (!transferDate) {
      return NextResponse.json({ error: "Invalid transfer date." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Transfer amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (!officerName) {
      return NextResponse.json(
        { error: "Officer name is required." },
        { status: 400 },
      );
    }

    const [sourceAccount, targetAccount] = await Promise.all([
      db.chartOfAccount.findUnique({ where: { id: sourceAssetId } }),
      db.chartOfAccount.findUnique({ where: { id: targetAssetId } }),
    ]);

    if (!sourceAccount || !targetAccount) {
      return NextResponse.json(
        { error: "One or both selected asset classifications were not found." },
        { status: 404 },
      );
    }

    if (
      !sourceAccount.accountCode.startsWith("102") ||
      !targetAccount.accountCode.startsWith("102")
    ) {
      return NextResponse.json(
        {
          error:
            "Transfers are only allowed between current asset classifications (102xxx).",
        },
        { status: 400 },
      );
    }

    if (!sourceAccount.isActive || !targetAccount.isActive) {
      return NextResponse.json(
        { error: "Both asset classifications must be active." },
        { status: 400 },
      );
    }

    const sourceBalance = Number(sourceAccount.balance || 0);
    if (sourceBalance < amount) {
      return NextResponse.json(
        {
          error: `Insufficient balance in "${sourceAccount.accountName}". Available: ${sourceBalance}, Required: ${amount}`,
        },
        { status: 400 },
      );
    }

    const transferCount = await db.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "AssetTransfer"`,
    );
    const transferCode = `TR-${String(Number(transferCount[0]?.count || 0) + 1).padStart(5, "0")}`;

    const created = await db.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO "AssetTransfer" (
        "id",
        "transferCode",
        "sourceAssetId",
        "targetAssetId",
        "amount",
        "transferDate",
        "receiptNo",
        "officerName",
        "notes",
        "branchId",
        "status",
        "requestedByUserId",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${crypto.randomUUID()},
        ${transferCode},
        ${sourceAssetId},
        ${targetAssetId},
        ${amount},
        ${transferDate},
        ${receiptNo || null},
        ${officerName},
        ${notes || null},
        ${branchId},
        ${TRANSFER_STATUS_PENDING},
        ${user.id},
        NOW(),
        NOW()
      )
      RETURNING *
    `);

    return NextResponse.json({ success: true, data: created[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating current asset transfer:", error);
    return NextResponse.json(
      { error: "Failed to create current asset transfer", details: error.message },
      { status: 500 },
    );
  }
}
