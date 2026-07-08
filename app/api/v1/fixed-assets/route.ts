import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { AssetApprovalStatus, AssetStatus, UserRole } from "@prisma/client";
import { bumpAccountingSyncState } from "@/lib/services/accounting-sync";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get("branchId") || undefined;
    const status = searchParams.get("status") || "ACTIVE";
    const approvalStatus = searchParams.get("approvalStatus") || undefined;

    const user = session.user as { role?: string; branchId?: string | null };
    const scopeBranchId =
      user.role !== UserRole.ADMIN && user.branchId ? user.branchId : branchId;

    const assets = (await db.fixedAsset.findMany({
      where: {
        ...(status ? { status: status as AssetStatus } : {}),
        ...(approvalStatus
          ? { approvalStatus: approvalStatus as AssetApprovalStatus }
          : {}),
        ...(scopeBranchId ? { branchId: scopeBranchId } : {}),
      },
      include: {
        branch: true,
      },
      orderBy: [{ assetName: "asc" }],
    })) as any[];

    return NextResponse.json({
      success: true,
      data: assets.map((asset) => ({
        id: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        category: asset.category,
        currentValue: Number(asset.currentValue || 0),
        purchasePrice: Number(asset.purchasePrice || 0),
        status: asset.status,
        approvalStatus: asset.approvalStatus,
        approvedAt: asset.approvedAt || null,
        rejectedAt: asset.rejectedAt || null,
        rejectionReason: asset.rejectionReason || null,
        disposalDate: asset.disposalDate || null,
        disposalMethod: asset.disposalMethod || null,
        disposalAmount: asset.disposalAmount ? Number(asset.disposalAmount) : null,
        branch: asset.branch
          ? { id: asset.branch.id, name: asset.branch.name }
          : null,
      })),
    });
  } catch (error: any) {
    console.error("Error loading fixed assets:", error);
    return NextResponse.json(
      { error: "Failed to load fixed assets", details: error.message },
      { status: 500 },
    );
  }
}

// POST /api/v1/fixed-assets - Create Fixed Asset and Sync to COA
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const userRole = (session.user as any).role;
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.ACCOUNTANT) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      assetName, 
      category, 
      purchaseDate, 
      purchasePrice, 
      depreciationRate, 
      usefulLifeYears 
    } = body;

    if (!assetName || !category || !purchasePrice) {
      return NextResponse.json(
        { error: "Missing required fields (Name, Category, Price)" },
        { status: 400 }
      );
    }

    // Generate Asset Code (e.g., FA-001)
    const count = await db.fixedAsset.count();
    const assetCode = `FA-${(count + 1).toString().padStart(5, "0")}`;

    const result = await db.$transaction(async (tx) => {
      // 1. Create Fixed Asset
      const asset = await tx.fixedAsset.create({
        data: {
          assetCode,
          assetName,
          category,
          description: body.description,
          purchaseDate: new Date(purchaseDate),
          purchasePrice: Number(purchasePrice),
          currentValue: Number(purchasePrice), // Initial value
          supplier: body.supplier,
          invoiceNumber: body.invoiceNumber,
          depreciationRate: Number(depreciationRate),
          usefulLifeYears: Number(usefulLifeYears),
          salvageValue: Number(body.salvageValue || 0),
          location: body.location,
          serialNumber: body.serialNumber,
          model: body.model,
          branchId: body.branchId,
          status: AssetStatus.ACTIVE,
        },
      });

      // 2. Sync to Chart of Accounts (Hub)
      const categoryMap: Record<string, string> = {
        "FURNITURE": "101300",
        "COMPUTERS": "101400",
        "VEHICLES": "101200",
        "LAND_BUILDINGS": "101100",
        "MACHINERY": "101500"
      };

      const parentCode = categoryMap[category] || "101000";
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { accountCode: parentCode }
      });

      if (!parentAccount) {
        throw new Error(`Parent account (${parentCode}) not found. Please run COA seeding.`);
      }
      
      const ledgerType = "ASSETS";
      
      // Generate COA Code (e.g. 1013xx for individual Furniture Assets)
      const latestAssetAccount = await tx.chartOfAccount.findFirst({
        where: { 
          accountCode: { startsWith: parentCode.substring(0, 4) },
          level: 4
        },
        orderBy: { accountCode: "desc" }
      });

      let nextCodeInt = 1;
      if (latestAssetAccount) {
        const currentLast = parseInt(latestAssetAccount.accountCode.substring(4));
        nextCodeInt = currentLast + 1;
      }
      const coaCode = `${parentCode.substring(0, 4)}${nextCodeInt.toString().padStart(2, "0")}`;

      await tx.chartOfAccount.create({
        data: {
          accountName: `${assetName} (${assetCode})`,
          accountCode: coaCode,
          fullCode: coaCode,
          ledgerType: "ASSETS",
          debitCredit: "DR", 
          isActive: true,
          level: 4, 
          parentId: parentAccount.id,
          description: `Fixed Asset: ${assetName} [${category}]`,
          category: category
        }
      });

      return asset;
    });

    void bumpAccountingSyncState("Fixed asset created");
    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error creating fixed asset:", error);
    return NextResponse.json(
      { error: "Failed to create fixed asset" },
      { status: 500 }
    );
  }
}
