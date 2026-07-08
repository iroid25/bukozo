import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { resolveBranchScope } from "@/lib/services/branch-scope";

export const dynamic = "force-dynamic";

import { getChartOfAccounts } from "@/lib/services/chartOfAccounts";

// GET /api/v1/chart-of-accounts - Fetch all accounts with optional filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = session.user as any;
    await ensureCoreChartOfAccountsStructure();
    await ensureEquityStructure();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const ledgerType = searchParams.get("ledgerType") || undefined;
    const parentId = searchParams.get("parentId") || undefined;
    const level = searchParams.get("level") ? parseInt(searchParams.get("level")!) : undefined;
    const search = searchParams.get("search") || undefined;
    const isActiveStr = searchParams.get("isActive");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : undefined;
    const coreOnlyStr = searchParams.get("coreOnly");
    const coreOnly = coreOnlyStr !== null ? coreOnlyStr === "true" : undefined;
    const numericOnlyStr = searchParams.get("numericOnly");
    const numericOnly = numericOnlyStr !== null ? numericOnlyStr === "true" : true;

    const branchId = resolveBranchScope(user, searchParams.get("branchId"));

    const result = await getChartOfAccounts({
      page,
      limit,
      ledgerType,
      parentId: parentId === "null" ? null : parentId,
      level,
      search,
      isActive,
      coreOnly,
      numericOnly,
      branchId,
    });

    const filteredData = result.data.filter((account: { accountCode?: string }) => account.accountCode !== "401006");
    const removedCount = result.data.length - filteredData.length;

    return NextResponse.json({
      ...result,
      data: filteredData,
      pagination: {
        ...result.pagination,
        total: Math.max(0, result.pagination.total - removedCount),
        totalPages: Math.max(1, Math.ceil(Math.max(0, result.pagination.total - removedCount) / limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching chart of accounts:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch chart of accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/chart-of-accounts - Create a new account
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.accountCode || !body.accountName || !body.ledgerType) {
      return NextResponse.json(
        { error: "Account code, name, and ledger type are required" },
        { status: 400 }
      );
    }

    // Check if account code already exists
    const existing = await db.chartOfAccount.findUnique({
      where: { accountCode: body.accountCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Account code already exists" },
        { status: 409 }
      );
    }

    // Validate parent if provided
    if (body.parentId) {
      const parent = await db.chartOfAccount.findUnique({
        where: { id: body.parentId },
      });

      if (!parent) {
        return NextResponse.json(
          { error: "Parent account not found" },
          { status: 404 }
        );
      }
    }

    // Create full code
    const fullCode = `${body.accountCode}  ${body.accountName}`;

    // Create account
    const account = await db.chartOfAccount.create({
      data: {
        accountCode: body.accountCode,
        accountName: body.accountName,
        fullCode,
        parentId: body.parentId || null,
        level: body.level || 3,
        ledgerType: body.ledgerType,
        category: body.category || null,
        product: body.product || null,
        currency: body.currency || "UGX",
        debitCredit: body.debitCredit || null,
        description: body.description || null,
        notes: body.notes || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        isSystem: false,
      },
      include: {
        parent: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        data: account,
        message: "Account created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
