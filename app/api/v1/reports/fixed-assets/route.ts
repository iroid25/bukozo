import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;


// POST /api/v1/reports/fixed-assets
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const { reportType, startDate, endDate, branchId: requestedBranchId, ...params } = await request.json();
    const branchId = resolveBranchScope(user, requestedBranchId);

    const start = startDate ? new Date(startDate) : new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    let data;

    switch (reportType) {
      case "assets-registered":
        data = await generateAssetsRegisteredReport(start, end, branchId);
        break;
      case "assets-listing":
        data = await generateAssetsListingReport(branchId);
        break;
      case "assets-depreciation":
        data = await generateAssetsDepreciationReport(params.year || new Date().getFullYear(), branchId);
        break;
      case "assets-disposal":
        data = await generateAssetsDisposalReport(start, end, branchId);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fixed assets report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// Assets Registered During Period
async function generateAssetsRegisteredReport(start: Date, end: Date, branchId?: string) {
  const assets = await db.fixedAsset.findMany({
    where: {
      purchaseDate: { gte: start, lte: end },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      branch: true,
      responsiblePerson: { select: { name: true } },
    },
    orderBy: { purchaseDate: "desc" },
  });

  const records = assets.map((asset) => ({
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    category: asset.category,
    purchaseDate: asset.purchaseDate.toISOString().split("T")[0],
    purchasePrice: Number(asset.purchasePrice),
    currentValue: Number(asset.currentValue),
    branch: asset.branch?.name || "N/A",
    responsiblePerson: asset.responsiblePerson?.name || "N/A",
    status: asset.status,
  }));

  return {
    data: records,
    summary: {
      totalRecords: records.length,
      totalPurchaseValue: records.reduce((sum, r) => sum + r.purchasePrice, 0),
      totalCurrentValue: records.reduce((sum, r) => sum + r.currentValue, 0),
    },
  };
}

// Assets Listing
async function generateAssetsListingReport(branchId?: string) {
  const assets = await db.fixedAsset.findMany({
    ...(branchId ? { where: { branchId } } : {}),
    include: {
      branch: true,
      responsiblePerson: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { assetCode: "asc" }],
  });

  const records = assets.map((asset) => ({
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    category: asset.category,
    purchaseDate: asset.purchaseDate.toISOString().split("T")[0],
    purchasePrice: Number(asset.purchasePrice),
    currentValue: Number(asset.currentValue),
    accumulatedDepreciation: Number(asset.accumulatedDepreciation),
    depreciationRate: asset.depreciationRate,
    status: asset.status,
    location: asset.location || "N/A",
    branch: asset.branch?.name || "N/A",
  }));

  const byCategory = records.reduce((acc: any, r) => {
    if (!acc[r.category]) {
      acc[r.category] = { count: 0, totalValue: 0 };
    }
    acc[r.category].count++;
    acc[r.category].totalValue += r.currentValue;
    return acc;
  }, {});

  return {
    data: records,
    summary: {
      totalRecords: records.length,
      totalPurchaseValue: records.reduce((sum, r) => sum + r.purchasePrice, 0),
      totalCurrentValue: records.reduce((sum, r) => sum + r.currentValue, 0),
      totalDepreciation: records.reduce((sum, r) => sum + r.accumulatedDepreciation, 0),
      byCategory,
    },
  };
}

// Assets Depreciation Schedule
async function generateAssetsDepreciationReport(year: number, branchId?: string) {
  const assets = await db.fixedAsset.findMany({
    where: {
      status: "ACTIVE",
      ...(branchId ? { branchId } : {}),
    },
    include: {
      branch: true,
    },
  });

  const records: any[] = [];

  for (const asset of assets) {
    const purchaseDate = new Date(asset.purchaseDate);
    const purchaseYear = purchaseDate.getFullYear();
    const purchaseMonth = purchaseDate.getMonth() + 1; // 1-indexed

    const purchasePrice = Number(asset.purchasePrice);
    const salvageValue = Number(asset.salvageValue || 0);
    const usefulLifeYears = asset.usefulLifeYears || 5;
    const depreciableAmount = purchasePrice - salvageValue;
    
    // Annual depreciation
    const annualDepreciation = depreciableAmount / usefulLifeYears;
    const monthlyDepreciation = annualDepreciation / 12;

    // Total months of useful life
    const totalLifeMonths = usefulLifeYears * 12;

    // Generate records for each month (1 to 12) of the target year
    for (let month = 1; month <= 12; month++) {
      const currentMonthDate = new Date(year, month - 1, 1);
      
      // If target month is before purchase month, no depreciation yet
      if (currentMonthDate < new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1)) {
        continue;
      }

      // Calculate how many months have elapsed from purchase month to target month
      const elapsedMonths = (year - purchaseYear) * 12 + (month - purchaseMonth) + 1;

      let deprAmountForMonth = 0;
      let accumDeprForMonth = 0;

      if (elapsedMonths <= 0) {
        deprAmountForMonth = 0;
        accumDeprForMonth = 0;
      } else if (elapsedMonths <= totalLifeMonths) {
        deprAmountForMonth = monthlyDepreciation;
        accumDeprForMonth = elapsedMonths * monthlyDepreciation;
      } else {
        // Fully depreciated
        deprAmountForMonth = 0;
        accumDeprForMonth = depreciableAmount;
      }

      const bookValue = purchasePrice - accumDeprForMonth;

      records.push({
        rowKey: `${asset.assetCode}-${year}-${String(month).padStart(2, "0")}`,
        assetCode: asset.assetCode,
        assetName: asset.assetName,
        category: asset.category,
        year: year,
        month: month,
        depreciationAmount: deprAmountForMonth,
        accumulatedDepreciation: accumDeprForMonth,
        bookValue: bookValue,
        isPosted: true,
        branch: asset.branch?.name || "N/A",
      });
    }
  }

  const monthlyTotals = records.reduce((acc: any, r) => {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
    if (!acc[key]) {
      acc[key] = { month: key, totalDepreciation: 0, count: 0 };
    }
    acc[key].totalDepreciation += r.depreciationAmount;
    acc[key].count++;
    return acc;
  }, {});

  return {
    data: records,
    summary: {
      totalRecords: records.length,
      totalDepreciation: records.reduce((sum, r) => sum + r.depreciationAmount, 0),
      monthlyTotals: Object.values(monthlyTotals),
    },
  };
}

// Assets Disposal Report
async function generateAssetsDisposalReport(start: Date, end: Date, branchId?: string) {
  const assets = await db.fixedAsset.findMany({
    where: {
      status: { in: ["DISPOSED", "WRITTEN_OFF"] },
      disposalDate: { gte: start, lte: end },
      ...(branchId ? { branchId } : {}),
    },
    include: {
      branch: true,
    },
    orderBy: { disposalDate: "desc" },
  });

  const records = assets.map((asset) => ({
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    category: asset.category,
    purchaseDate: asset.purchaseDate.toISOString().split("T")[0],
    purchasePrice: Number(asset.purchasePrice),
    disposalDate: asset.disposalDate?.toISOString().split("T")[0] || "N/A",
    disposalMethod: asset.disposalMethod || "N/A",
    disposalAmount: Number(asset.disposalAmount || 0),
    bookValueAtDisposal: Number(asset.currentValue),
    gainLoss: Number(asset.disposalAmount || 0) - Number(asset.currentValue),
    branch: asset.branch?.name || "N/A",
  }));

  return {
    data: records,
    summary: {
      totalRecords: records.length,
      totalDisposalAmount: records.reduce((sum, r) => sum + r.disposalAmount, 0),
      totalGainLoss: records.reduce((sum, r) => sum + r.gainLoss, 0),
    },
  };
}

