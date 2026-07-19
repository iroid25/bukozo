import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

// GET /api/v1/journal-entries - List journal entries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const accountId = searchParams.get("accountId");
    const transactionId = searchParams.get("transactionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (accountId) {
      where.accountId = accountId;
    }

    if (transactionId) {
      where.transactionId = transactionId;
    }

    if (startDate || endDate) {
      where.entryDate = {};
      if (startDate) {
        where.entryDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.entryDate.lte = new Date(endDate);
      }
    }

    // Fetch journal entries
    const [entries, total] = await Promise.all([
      db.journalEntry.findMany({
        where,
        skip,
        take: limit,
        include: {
          account: {
            select: {
              id: true,
              accountCode: true,
              accountName: true,
              fullCode: true,
            },
          },
          transaction: {
            select: {
              transactionRef: true,
              type: true,
              description: true,
            },
          },
          createdBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          entryDate: "desc",
        },
      }),
      db.journalEntry.count({ where }),
    ]);

    return NextResponse.json({
      data: entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching journal entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries" },
      { status: 500 }
    );
  }
}

// POST /api/v1/journal-entries - Create manual journal entry
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
    if (!body.entries || !Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json(
        { error: "Journal entries array is required" },
        { status: 400 }
      );
    }

    // Calculate totals
    const totalDebits = body.entries.reduce((sum: number, e: any) => sum + (e.debitAmount || 0), 0);
    const totalCredits = body.entries.reduce((sum: number, e: any) => sum + (e.creditAmount || 0), 0);

    // Validate debit = credit
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { 
          error: "Journal entry must balance (debits must equal credits)",
          details: { totalDebits, totalCredits, difference: totalDebits - totalCredits }
        },
        { status: 400 }
      );
    }

    // Generate entry number
    const entryNumber = `JE${Date.now()}`;

    // Create journal entries in transaction
    const result = await db.$transaction(async (tx) => {
      const createdEntries = [];

      for (const entry of body.entries) {
        // Validate account exists
        const account = await tx.chartOfAccount.findUnique({
          where: { id: entry.accountId },
        });

        if (!account) {
          throw new Error(`Account ${entry.accountId} not found`);
        }

        // Create journal entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: entry.accountId,
            debitAmount: entry.debitAmount || 0,
            creditAmount: entry.creditAmount || 0,
            description: body.description || "Manual journal entry",
            reference: body.reference || null,
            transactionId: body.transactionId || null,
            createdByUserId: (session.user as any).id,
          },
          include: {
            account: {
              select: {
                accountCode: true,
                accountName: true,
              },
            },
          },
        });

        // Update account balances
        await tx.chartOfAccount.update({
          where: { id: entry.accountId },
          data: buildAccountBalanceUpdate(account, {
            debitAmount: entry.debitAmount || 0,
            creditAmount: entry.creditAmount || 0,
          }),
        });

        createdEntries.push(journalEntry);
      }

      return createdEntries;
    });

    return NextResponse.json(
      {
        data: result,
        message: "Journal entries created successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating journal entries:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create journal entries" },
      { status: 500 }
    );
  }
}
