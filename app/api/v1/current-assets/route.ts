import { NextRequest, NextResponse } from "next/server";
import { AssetType, Prisma, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

const ASSET_APPROVAL_STATUS_PENDING = "PENDING_APPROVAL";
const ASSET_APPROVAL_STATUS_APPROVED = "APPROVED";
const ASSET_APPROVAL_STATUS_REJECTED = "REJECTED";

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
    const approvalStatus = searchParams.get("approvalStatus") || undefined;
    const status = searchParams.get("status") || undefined;

    const assets = await db.$queryRaw<any[]>(Prisma.sql`
      SELECT *
      FROM "FixedAsset"
      WHERE "assetType" = ${AssetType.CURRENT}
      ${user.role !== UserRole.ADMIN && user.branchId ? Prisma.sql`AND "branchId" = ${user.branchId}` : Prisma.empty}
      ${user.role === UserRole.ADMIN && branchId && branchId !== "all" ? Prisma.sql`AND "branchId" = ${branchId}` : Prisma.empty}
      ${approvalStatus ? Prisma.sql`AND "approvalStatus" = ${approvalStatus}` : Prisma.empty}
      ${status ? Prisma.sql`AND "status" = ${status}` : Prisma.empty}
      ORDER BY "createdAt" DESC
    `);

    const branchIds = Array.from(new Set(assets.map((asset) => asset.branchId).filter(Boolean)));
    const userIds = Array.from(new Set(assets.map((asset) => asset.responsiblePersonId).filter(Boolean)));

    const [branches, users] = await Promise.all([
      branchIds.length
        ? db.branch.findMany({
            where: { id: { in: branchIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

    const branchMap = new Map(branches.map((branch) => [branch.id, branch]));
    const userMap = new Map(users.map((item) => [item.id, item]));

    const data = assets.map((asset) => ({
      ...asset,
      branch: asset.branchId ? branchMap.get(asset.branchId) || null : null,
      responsiblePerson: asset.responsiblePersonId
        ? userMap.get(asset.responsiblePersonId) || null
        : null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error loading current assets:", error);
    return NextResponse.json(
      { error: "Failed to load current assets", details: error.message },
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

    const body = await request.json();
    const assetName = toText(body.assetName);
    const category = toText(body.category);
    const branchId = toText(body.branchId) || user.branchId || "";
    const officerName = toText(body.officerName) || user.name || "";
    const invoiceNumber = toText(body.invoiceNumber);
    const notes = toText(body.notes);
    const amount = Number(body.amount || 0);
    const assetDate = toDate(body.assetDate);

    if (!assetName || !category || !branchId || !officerName || !invoiceNumber) {
      return NextResponse.json(
        {
          error:
            "Asset name, category, branch, officer name, invoice number, and amount are required.",
        },
        { status: 400 },
      );
    }

    if (!assetDate) {
      return NextResponse.json({ error: "Invalid asset date." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (user.role !== UserRole.ADMIN && user.branchId && branchId !== user.branchId) {
      return NextResponse.json(
        { error: "You can only create current assets for your own branch." },
        { status: 403 },
      );
    }

    const branch = await db.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    }

    const currentCount = await db.fixedAsset.count({
      where: { assetType: AssetType.CURRENT },
    });
    const assetCode = `CA-${String(currentCount + 1).padStart(5, "0")}`;

    const created = await db.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO "FixedAsset" (
        "id",
        "assetCode",
        "assetName",
        "category",
        "description",
        "officerName",
        "purchaseDate",
        "purchasePrice",
        "supplier",
        "invoiceNumber",
        "depreciationMethod",
        "depreciationRate",
        "usefulLifeYears",
        "salvageValue",
        "currentValue",
        "accumulatedDepreciation",
        "location",
        "serialNumber",
        "model",
        "status",
        "branchId",
        "responsiblePersonId",
        "createdAt",
        "updatedAt",
        "quantity",
        "receiptNo",
        "assetType",
        "approvalStatus",
        "approvedAt",
        "rejectedAt",
        "rejectionReason"
      ) VALUES (
        ${crypto.randomUUID()},
        ${assetCode},
        ${assetName},
        ${category},
        ${notes || null},
        ${officerName},
        ${assetDate},
        ${amount},
        NULL,
        ${invoiceNumber},
        ${"STRAIGHT_LINE"},
        ${0},
        ${0},
        ${0},
        ${0},
        ${0},
        NULL,
        NULL,
        NULL,
        ${"ACTIVE"},
        ${branchId},
        ${user.id},
        NOW(),
        NOW(),
        ${1},
        ${invoiceNumber},
        ${AssetType.CURRENT},
        ${ASSET_APPROVAL_STATUS_PENDING},
        NULL,
        NULL,
        NULL
      )
      RETURNING *
    `);

    return NextResponse.json({ success: true, data: created[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating current asset:", error);
    return NextResponse.json(
      { error: "Failed to create current asset", details: error.message },
      { status: 500 },
    );
  }
}
