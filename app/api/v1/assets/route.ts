import { NextRequest, NextResponse } from "next/server";
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import {
  AssetApprovalStatus,
  AssetStatus,
  AssetType,
  TransactionType,
  UserRole,
} from '@prisma/client';
import { bumpAccountingSyncState } from '@/lib/services/accounting-sync';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const branchId = searchParams.get("branchId") || undefined;
    const assetType = searchParams.get("assetType") || undefined;
    const status = searchParams.get("status") || undefined;
    const approvalStatus = searchParams.get("approvalStatus") || undefined;

    const where: any = {};
    if (assetType) where.assetType = assetType as AssetType;
    if (status) where.status = status as AssetStatus;
    if (approvalStatus) where.approvalStatus = approvalStatus as AssetApprovalStatus;

    if (user.role !== UserRole.ADMIN && user.branchId) {
      where.branchId = user.branchId;
    } else if (branchId && branchId !== "all") {
      where.branchId = branchId;
    }

    const assets = await db.fixedAsset.findMany({
      where,
      include: {
        branch: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: assets.map((asset) => ({
        id: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        assetType: asset.assetType,
        category: asset.category,
        currentValue: Number(asset.currentValue || 0),
        purchasePrice: Number(asset.purchasePrice || 0),
        status: asset.status,
        approvalStatus: asset.approvalStatus,
        receiptNo: asset.receiptNo || null,
        accountId: asset.accountId || null,
        approvedAt: asset.approvedAt || null,
        rejectedAt: asset.rejectedAt || null,
        rejectionReason: asset.rejectionReason || null,
        disposalDate: asset.disposalDate || null,
        disposalMethod: asset.disposalMethod || null,
        disposalAmount: asset.disposalAmount ? Number(asset.disposalAmount) : null,
        branch: asset.branch ? { id: asset.branch.id, name: asset.branch.name } : null,
      })),
    });
  } catch (error: any) {
    console.error("Error loading assets:", error);
    return NextResponse.json(
      { error: "Failed to load assets", details: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const data = await request.json();
    const selectedTellerUserId =
      typeof data.tellerUserId === "string" && data.tellerUserId.trim()
        ? data.tellerUserId.trim()
        : null;

    if (
      selectedTellerUserId &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT
    ) {
      return NextResponse.json(
        { error: "Only admin or accountant users can choose a teller float source." },
        { status: 403 }
      );
    }

    if (data.assetType === "FIXED" && !selectedTellerUserId) {
      return NextResponse.json(
        {
          error:
            "Fixed assets must be funded from a teller float. Please select a teller before submitting this asset.",
        },
        { status: 400 },
      );
    }

    const prefix = data.assetType === "FIXED" ? "FA" : "CA";

    const result = await db.$transaction(async (tx) => {
      // Count inside the transaction so concurrent POSTs can't produce duplicate codes.
      const count = await tx.fixedAsset.count({ where: { assetType: data.assetType } });
      const assetCode = `${prefix}-${(count + 1).toString().padStart(5, "0")}`;
      const totalCost = Number(data.purchasePrice) * Number(data.quantity || 1);

      // Only look up a float when a teller is explicitly chosen.
      // Managers/accountants do NOT have floats — their cash source is the vault/bank.
      let floatOwner = null;
      let userFloat = selectedTellerUserId
        ? await tx.userFloat.findUnique({ where: { userId: selectedTellerUserId } })
        : null;

      if (selectedTellerUserId) {
        floatOwner = await tx.user.findUnique({
          where: { id: selectedTellerUserId },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            role: true,
            branchId: true,
            isActive: true,
          },
        });

        if (!floatOwner || !floatOwner.isActive) {
          throw new Error("The selected teller is not available for float-funded asset purchases.");
        }

        if (floatOwner.role !== UserRole.TELLER) {
          throw new Error("The selected float source must belong to an active teller.");
        }

        if (data.branchId && floatOwner.branchId && data.branchId !== floatOwner.branchId) {
          throw new Error("The selected teller belongs to a different branch than this asset.");
        }

        if (!userFloat) {
          throw new Error("No active float was found for the selected teller.");
        }
      }

      if (userFloat) {
        if (!userFloat.isActiveForDay) {
          throw new Error(
            selectedTellerUserId
              ? "The selected teller float is not active for the day."
              : "Your teller float is not active for the day.",
          );
        }

        if (userFloat.balance < totalCost) {
          const floatHolderName = floatOwner
            ? floatOwner.name ||
              [floatOwner.firstName, floatOwner.lastName].filter(Boolean).join(" ")
            : "available float";
          throw new Error(
            `Insufficient teller float${
              selectedTellerUserId ? ` for ${floatHolderName}` : ""
            }. Required: UGX ${totalCost.toLocaleString()}, Available: UGX ${userFloat.balance.toLocaleString()}`,
          );
        }
      }

      // 1. Find the parent classification in COA
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { accountCode: data.classificationCode }
      });

      if (!parentAccount) {
        throw new Error(`Classification account (${data.classificationCode}) not found. Please verify COA.`);
      }

      const category = parentAccount.category || parentAccount.accountName;

      // 2. Create Asset
      const asset = await tx.fixedAsset.create({
        data: {
          assetCode,
          assetType: data.assetType,
          assetName: data.assetName,
          category: category,
          description: data.description,
          purchaseDate: new Date(data.purchaseDate),
          purchasePrice: Number(data.purchasePrice),
          currentValue: Number(data.purchasePrice), // Initial value
          supplier: data.supplier,
          invoiceNumber: data.invoiceNumber,
          depreciationRate: Number(data.depreciationRate),
          usefulLifeYears: Number(data.usefulLifeYears),
          salvageValue: Number(data.salvageValue || 0),
          location: data.location,
          serialNumber: data.serialNumber,
          model: data.model,
          quantity: Number(data.quantity || 1),
          receiptNo: data.receiptNo,
          branchId: data.branchId,
          status: AssetStatus.ACTIVE,
        },
      });

      // 3. Sync to Chart of Accounts (Hub)
      const parentCode = data.classificationCode;
      
      // Generate COA Code (e.g. 1013xx for individual assets under Furniture 101300)
      // Standardise parentCode to drop trailing zeros (e.g., 101300 -> 1013)
      const baseCode = parentCode.endsWith("00") ? parentCode.slice(0, 4) : parentCode;
      const latestAssetAccount = await tx.chartOfAccount.findFirst({
        where: { 
          accountCode: { startsWith: baseCode },
          level: parentAccount.level + 1
        },
        orderBy: { accountCode: "desc" }
      });

      let nextCodeInt = 1;
      if (latestAssetAccount) {
        const suffix = latestAssetAccount.accountCode.substring(baseCode.length);
        if (suffix) {
            nextCodeInt = parseInt(suffix) + 1;
        }
      }
      const coaCode = `${baseCode}${nextCodeInt.toString().padStart(2, "0")}`;

       const coaAccount = await tx.chartOfAccount.create({
         data: {
           accountName: `${data.assetName} (${assetCode})`,
           accountCode: coaCode,
           fullCode: coaCode,
           ledgerType: "ASSETS",
           debitCredit: "DR", 
           isActive: true,
           level: parentAccount.level + 1,
           parentId: parentAccount.id,
           description: `Fixed Asset: ${data.assetName} [${category}]`,
           category: category
         }
       });

       // 4. Determine Depreciation Accounts
       let depExpCode = "502800"; // Generic Depreciation Expense
       if (parentCode.startsWith("1012")) depExpCode = "502801"; // Motor Vehicle
       else if (parentCode.startsWith("1013")) depExpCode = "502802"; // Furniture
       else if (parentCode.startsWith("1014")) depExpCode = "502804"; // Buildings/Computers
       else if (parentCode.startsWith("1015")) depExpCode = "502807"; // Other equipment
       
       const depExpAccount = await tx.chartOfAccount.findFirst({ where: { accountCode: depExpCode } });

       // 5. Update Asset with Account IDs
       await tx.fixedAsset.update({
         where: { id: asset.id },
         data: {
           accountId: coaAccount.id,
           depreciationExpenseAccountId: depExpAccount?.id || null,
         }
       });

      // 6. Determine credit account: teller float for FIXED assets, Bank/Cash for CURRENT assets.
      const creditAccount = userFloat
        ? await tx.chartOfAccount.findFirst({
            where: {
              ledgerType: "ASSETS",
              accountName: { contains: "FLOAT", mode: "insensitive" },
              isActive: true,
            },
          })
        : (await tx.chartOfAccount.findFirst({ where: { accountCode: "102002", isActive: true } })) ||
          (await tx.chartOfAccount.findFirst({ where: { accountCode: "102001", isActive: true } }));

      if (!creditAccount) {
        throw new Error(
          userFloat
            ? "Float account not found for asset purchase posting. Please set up the teller float COA account."
            : "Bank/Cash account (102002/102001) not found in COA. Please verify your chart of accounts.",
        );
      }

      const entryNumber = `JE-ASSET-PURCHASE-${Date.now()}`;
      const creditDescription = userFloat
        ? `Teller float used for asset purchase: ${data.assetName} (${assetCode})`
        : `Bank/Cash payment for asset purchase: ${data.assetName} (${assetCode})`;

      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: coaAccount.id,
          debitAmount: totalCost,
          creditAmount: 0,
          description: `Purchase of Asset: ${data.assetName} (${assetCode})`,
          reference: data.receiptNo,
          createdByUserId: user.id,
        }
      });

      await tx.journalEntry.create({
        data: {
          entryNumber,
          accountId: creditAccount.id,
          debitAmount: 0,
          creditAmount: totalCost,
          description: creditDescription,
          reference: data.receiptNo,
          createdByUserId: user.id,
        }
      });

      await tx.chartOfAccount.update({
        where: { id: coaAccount.id },
        data: { balance: { increment: totalCost }, debitBalance: { increment: totalCost } }
      });

      await tx.chartOfAccount.update({
        where: { id: creditAccount.id },
        data: { balance: { decrement: totalCost }, creditBalance: { increment: totalCost } }
      });

      if (userFloat) {
        await tx.userFloat.update({
          where: { id: userFloat.id },
          data: { balance: { decrement: totalCost } },
        });

        await tx.floatTransaction.create({
          data: {
            floatId: userFloat.id,
            type: TransactionType.OTHER,
            amount: totalCost,
            description: `Asset purchase using teller float - ${data.assetName} (${assetCode}) [teller: ${floatOwner?.name || selectedTellerUserId}]`,
            performedByUserId: user.id,
            relatedTransactionId: asset.id,
          },
        });
      }

       return asset;
    });

    void bumpAccountingSyncState("Fixed asset created");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error creating fixed asset:", error);
    return NextResponse.json(
      { error: "Failed to create fixed asset", details: error.message },
      { status: 500 }
    );
  }
}
