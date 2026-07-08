import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import { ensureAssetStructure } from '@/lib/services/asset-structure';
import { ensureLiabilityStructure } from '@/lib/services/liability-structure';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'FIXED'; 

    if (type === "FIXED" || type === "CURRENT") {
      await ensureAssetStructure();
    }
    if (type === "LIABILITY_CURRENT" || type === "LIABILITY_NON_CURRENT") {
      await ensureLiabilityStructure();
    }

    let prefix: string[] = [];
    if (type === "FIXED") prefix = ["101"];
    else if (type === "CURRENT") prefix = ["102"];
    else if (type === "LIABILITY_CURRENT") prefix = ["201"];
    else if (type === "LIABILITY_NON_CURRENT") prefix = ["202"];
    else if (type === "EQUITY") prefix = ["300", "301", "302", "303", "304"];
    
    if (type === "EQUITY") {
      const equityAccounts = await db.chartOfAccount.findMany({
        where: {
          OR: prefix.map((p) => ({ accountCode: { startsWith: p } })),
          level: { in: [1, 2, 3] },
          isActive: true,
        },
        include: {
          _count: {
            select: {
              children: true,
            },
          },
        },
        orderBy: {
          accountCode: "asc",
        },
      });

      const structuralEquityCategories = equityAccounts.filter((account) => {
        const notes = (account.notes || "").toUpperCase();
        const description = account.description || "";

        if (account.accountCode === "300000") return false;
        if (notes === "EQUITY_ITEM") return false;
        if (description.startsWith("Equity entry under [")) return false;

        return (
          account.accountCode.endsWith("000") ||
          notes === "EQUITY_CATEGORY" ||
          account._count.children > 0
        );
      });

      return NextResponse.json(structuralEquityCategories);
    }

    const accounts = await db.chartOfAccount.findMany({
      where: {
        OR: prefix.map(p => ({ accountCode: { startsWith: p } })),
        level: { in: [1, 2, 3] }, // Level 2 and 3 for Liability categories
        isActive: true,
      },
      orderBy: {
        accountCode: "asc",
      },
    });

    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error('Error fetching asset classifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset classifications', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const type = String(body.type || "FIXED").toUpperCase();
    const classificationName = String(body.classificationName || "").trim();
    const requestedParentCode = String(body.parentClassificationCode || "").trim();

    if (!classificationName) {
      return NextResponse.json(
        { error: "Classification name is required." },
        { status: 400 }
      );
    }

    const allowedTypes = new Set(["FIXED", "CURRENT", "LIABILITY_CURRENT", "LIABILITY_NON_CURRENT"]);
    if (!allowedTypes.has(type)) {
      return NextResponse.json(
        { error: "Invalid classification type for creation." },
        { status: 400 }
      );
    }

    const defaultParentCode =
      type === "FIXED"
        ? "101000"
        : type === "CURRENT"
          ? "102000"
          : type === "LIABILITY_CURRENT"
            ? "201000"
            : "202000";
    const parentCode = requestedParentCode || defaultParentCode;
    let parentAccount = await db.chartOfAccount.findUnique({
      where: { accountCode: parentCode },
    });

    if (!parentAccount) {
      if (
        type !== "FIXED" &&
        type !== "CURRENT" &&
        type !== "LIABILITY_CURRENT" &&
        type !== "LIABILITY_NON_CURRENT"
      ) {
        return NextResponse.json(
          { error: "Parent classification account not found." },
          { status: 404 }
        );
      }

      if (type === "FIXED" || type === "CURRENT") {
        await ensureAssetStructure();
      } else {
        await ensureLiabilityStructure();
      }
      parentAccount = await db.chartOfAccount.findUnique({
        where: { accountCode: parentCode },
      });
    }

    if (!parentAccount) {
      return NextResponse.json(
        { error: "Parent classification account not found." },
        { status: 404 }
      );
    }

    if ((type === "FIXED" || type === "CURRENT") && parentAccount.ledgerType !== "ASSETS") {
      return NextResponse.json(
        { error: "Parent classification must be an asset account." },
        { status: 400 }
      );
    }
    if (
      (type === "LIABILITY_CURRENT" || type === "LIABILITY_NON_CURRENT") &&
      parentAccount.ledgerType !== "LIABILITIES"
    ) {
      return NextResponse.json(
        { error: "Parent classification must be a liability account." },
        { status: 400 }
      );
    }

    const existingCategory = await db.chartOfAccount.findFirst({
      where: {
        accountName: { equals: classificationName, mode: "insensitive" },
        parentId: parentAccount.id,
        ledgerType: type.startsWith("LIABILITY") ? "LIABILITIES" : "ASSETS",
        isActive: true,
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: "That classification already exists under this parent." },
        { status: 409 }
      );
    }

    const nextCodeForParent = async (parentCode: string) => {
      const baseCode = parentCode.endsWith("000")
        ? parentCode.slice(0, 3)
        : parentCode.endsWith("00")
          ? parentCode.slice(0, 4)
          : parentCode;

      const suffixLength = parentCode.endsWith("000") ? 3 : 2;
      const initialStart = 1;

      const latestAccount = await db.chartOfAccount.findFirst({
        where: {
          accountCode: { startsWith: baseCode },
          level: parentAccount.level + 1,
          NOT: { accountCode: parentCode },
        },
        orderBy: { accountCode: "desc" },
      });

      let nextCodeInt = initialStart;
      if (latestAccount) {
        const suffix = latestAccount.accountCode.substring(baseCode.length);
        if (suffix) {
          nextCodeInt = Number.parseInt(suffix, 10) + 1;
        }
      }

      let candidate = `${baseCode}${nextCodeInt.toString().padStart(suffixLength, "0")}`;
      while (
        await db.chartOfAccount.findUnique({
          where: { accountCode: candidate },
        })
      ) {
        nextCodeInt += 1;
        candidate = `${baseCode}${nextCodeInt.toString().padStart(suffixLength, "0")}`;
      }

      return candidate;
    };

    const generatedCode = await nextCodeForParent(parentAccount.accountCode);

    const account = await db.chartOfAccount.create({
      data: {
        accountName: classificationName,
        accountCode: generatedCode,
        fullCode: generatedCode,
        parentId: parentAccount.id,
        level: parentAccount.level + 1,
        ledgerType: type.startsWith("LIABILITY") ? "LIABILITIES" : "ASSETS",
        debitCredit: type.startsWith("LIABILITY") ? "CR" : "DR",
        category: parentAccount.category || parentAccount.accountName,
        description: `${
          type.startsWith("LIABILITY") ? "Liability" : "Asset"
        } classification under ${parentAccount.accountName}`,
        isActive: true,
        isSystem: false,
      },
    });

    return NextResponse.json(
      { success: true, data: account },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating asset classification:", error);
    return NextResponse.json(
      {
        error: "Failed to create asset classification",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
