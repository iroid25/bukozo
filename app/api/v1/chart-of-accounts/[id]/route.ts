import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { hydrateAccountsWithJournalBalances } from "@/lib/services/chartOfAccounts";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { resolveBranchScope } from "@/lib/services/branch-scope";

// GET /api/v1/chart-of-accounts/[id] - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await ensureCoreChartOfAccountsStructure();

    // Await params in Next.js 15
    const { id } = await params;
    const requestedBranchId = request.nextUrl.searchParams.get("branchId");
    const branchId = resolveBranchScope(session.user as { role: string; branchId?: string | null }, requestedBranchId);

    const account = await db.chartOfAccount.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            fullCode: true,
          },
        },
        children: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            fullCode: true,
            level: true,
            balance: true,
          },
          orderBy: {
            accountCode: "asc",
          },
        },
        _count: {
          select: {
            journalEntries: true,
            debitTransactions: true,
            creditTransactions: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const liveLoansAccount =
      account.accountCode === "102003"
        ? await db.chartOfAccount.findFirst({
            where: { accountCode: "107000", ledgerType: "ASSETS" },
          })
        : null;

    const resolvedAccount = liveLoansAccount || account;

    const [hydratedAccount] = await hydrateAccountsWithJournalBalances([
      {
        id: resolvedAccount.id,
        ledgerType: resolvedAccount.ledgerType,
        balance: resolvedAccount.balance,
        debitBalance: resolvedAccount.debitBalance,
        creditBalance: resolvedAccount.creditBalance,
      },
    ], branchId);

    const accountData = resolvedAccount as typeof resolvedAccount & {
      children?: typeof account.children;
    };

    return NextResponse.json({
      data: {
        ...resolvedAccount,
        children: Array.isArray(accountData.children) ? accountData.children : [],
        balance: hydratedAccount?.balance ?? resolvedAccount.balance,
        debitBalance: hydratedAccount?.debitBalance ?? resolvedAccount.debitBalance,
        creditBalance: hydratedAccount?.creditBalance ?? resolvedAccount.creditBalance,
      },
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

// PUT /api/v1/chart-of-accounts/[id] - Update account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Await params in Next.js 15
    const { id } = await params;

    const body = await request.json();

    // Check if account exists
    const existing = await db.chartOfAccount.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Prevent changing account code (immutable)
    if (body.accountCode && body.accountCode !== existing.accountCode) {
      return NextResponse.json(
        { error: "Account code cannot be changed" },
        { status: 400 }
      );
    }

    // Update account
    const account = await db.chartOfAccount.update({
      where: { id },
      data: {
        accountName: body.accountName || existing.accountName,
        fullCode: body.accountName 
          ? `${existing.accountCode}  ${body.accountName}`
          : existing.fullCode,
        category: body.category !== undefined ? body.category : existing.category,
        product: body.product !== undefined ? body.product : existing.product,
        currency: body.currency || existing.currency,
        debitCredit: body.debitCredit !== undefined ? body.debitCredit : existing.debitCredit,
        description: body.description !== undefined ? body.description : existing.description,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
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

    return NextResponse.json({
      data: account,
      message: "Account updated successfully",
    });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { error: "Failed to update account" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/chart-of-accounts/[id] - Soft delete account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Await params in Next.js 15
    const { id } = await params;

    // Check if account exists
    const account = await db.chartOfAccount.findUnique({
      where: { id },
      include: {
        children: true,
        _count: {
          select: {
            journalEntries: true,
          },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Prevent deletion if has children
    if (account.children.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with child accounts" },
        { status: 400 }
      );
    }

    // Prevent deletion if has transactions
    if (account._count.journalEntries > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with existing transactions" },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await db.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: "Account deactivated successfully",
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
