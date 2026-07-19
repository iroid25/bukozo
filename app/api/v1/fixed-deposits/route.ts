import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { getInterestConfiguration } from "@/services/interest-config.service";
import { assertMemberCanTransact } from "@/lib/member-transact-eligibility";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

// GET /api/v1/fixed-deposits - Fetch all fixed deposits
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = (session.user as any);
    const userRole = user.role;
    const userBranchId = user.branchId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const memberId = searchParams.get("memberId") || "";
    const institutionId = searchParams.get("institutionId") || "";
    const status = searchParams.get("status") || "";

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Branch Isolation
    if (userRole !== "ADMIN") {
      if (!userBranchId) {
        return NextResponse.json({ error: "Branch access required" }, { status: 403 });
      }
      where.branchId = userBranchId;
    }

    if (memberId) where.memberId = memberId;
    if (institutionId) where.institutionId = institutionId;
    if (status) where.status = status;

    // Fetch fixed deposits with pagination
    const [fixedDeposits, total] = await Promise.all([
      db.fixedDeposit.findMany({
        where,
        skip,
        take: limit,
        include: {
          member: {
            select: {
              memberNumber: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          institution: {
            select: {
              institutionNumber: true,
              institutionName: true,
              institutionEmail: true,
            }
          },
          branch: {
            select: {
              name: true,
              location: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.fixedDeposit.count({ where }),
    ]);

    return NextResponse.json({
      data: fixedDeposits,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching fixed deposits:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixed deposits" },
      { status: 500 }
    );
  }
}

// POST /api/v1/fixed-deposits - Create a new fixed deposit
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
    if (!["ADMIN", "BRANCHMANAGER", "TELLER"].includes(userRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if ((!body.memberId && !body.institutionId) || !body.principalAmount || !body.termMonths || !body.sourceAccountId) {
      return NextResponse.json(
        { error: "Member or Institution, principal amount, term, and source account are required" },
        { status: 400 }
      );
    }

    const branchId = body.branchId || (session.user as any).branchId;
    if (!branchId) {
       return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    if (body.memberId) {
      try {
        await assertMemberCanTransact(body.memberId);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Member is not eligible to transact yet" },
          { status: 400 },
        );
      }
    }

    // BUGFIX: Auto-calculate interest rate from system configuration
    const interestConfig = await getInterestConfiguration();
    const interestRate = interestConfig.fixedDepositInterestRate;

    // Calculate maturity date and amount
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const maturityDate = new Date(startDate);
    maturityDate.setMonth(maturityDate.getMonth() + body.termMonths);

    // Simple interest calculation: P + (P * R * T)
    // Using system-configured interest rate instead of user input
    const interest = body.principalAmount * (interestRate / 100) * (body.termMonths / 12);
    const maturityAmount = body.principalAmount + interest;

    // Generate account number
    const accountNumber = `FD${Date.now()}`;
    const transactionRef = `FD-CRE-${Date.now()}`;
    const entryNumber = `JE-FD-${Date.now()}`;

    // Fetch GL accounts for journal entries
    let [cashAccount, fdLiabilityAccount] = await Promise.all([
      db.chartOfAccount.findFirst({ where: { accountCode: "102001", isActive: true } }),
      db.chartOfAccount.findFirst({
        where: {
          ledgerType: "LIABILITIES",
          isActive: true,
          OR: [
            { accountCode: "201003" },
            { accountCode: "201100" },
            { accountCode: "2014" },
            { accountName: { contains: "FIXED DEPOSIT", mode: "insensitive" } },
          ],
        },
      }),
    ]);
    

    // Auto-create Cash Account if it doesn't exist
    if (!cashAccount) {
      try {
        cashAccount = await db.chartOfAccount.create({
          data: {
            accountCode: "102001",
            fullCode: "102001",
            accountName: "Cash at Hand",
            level: 3,
            ledgerType: "ASSETS",
            isActive: true,
            isSystem: true,
            debitBalance: 0,
            creditBalance: 0,
            balance: 0,
            description: "Cash at hand for daily operations (auto-created)",
          },
        });
      } catch (error: any) {
        // If creation fails (e.g., unique constraint), try to find any cash account
        cashAccount = await db.chartOfAccount.findFirst({ 
          where: { 
            OR: [
              { accountName: { contains: "CASH", mode: "insensitive" } },
              { accountName: { contains: "BANK", mode: "insensitive" } }
            ],
            ledgerType: "ASSETS",
            isActive: true 
          } 
        });
        if (!cashAccount) {
          return NextResponse.json(
            { error: "System configuration error: Unable to create or find cash account. Please contact administrator.", details: error.message },
            { status: 500 }
          );
        }
      }
    }

    // Auto-create or normalize Fixed Deposit Liability Account if it doesn't exist
    if (!fdLiabilityAccount) {
      try {
        fdLiabilityAccount = await db.chartOfAccount.upsert({
          where: { accountCode: "201003" },
          update: {
            accountName: "Member Fixed Deposits",
            fullCode: "201003",
            ledgerType: "LIABILITIES",
            isActive: true,
            isSystem: true,
            description: "Liability account for member fixed deposit accounts",
          },
          create: {
            accountCode: "201003",
            fullCode: "201003",
            accountName: "Member Fixed Deposits",
            level: 3,
            ledgerType: "LIABILITIES",
            isActive: true,
            isSystem: true,
            debitBalance: 0,
            creditBalance: 0,
            balance: 0,
            description: "Liability account for member fixed deposit accounts (auto-created)",
          },
        });
      } catch (error: any) {
        fdLiabilityAccount = await db.chartOfAccount.findFirst({
          where: {
            ledgerType: "LIABILITIES",
            isActive: true,
            OR: [
              { accountCode: "201003" },
              { accountCode: "201100" },
              { accountCode: "2014" },
              { accountName: { contains: "FIXED DEPOSIT", mode: "insensitive" } },
            ],
          },
        });

        if (!fdLiabilityAccount) {
          return NextResponse.json(
            { error: "System configuration error: Unable to create Fixed Deposit Liability account. Please contact administrator.", details: error.message },
            { status: 500 }
          );
        }
      }
    }

    // NEW: Validate source account if provided (for transfers from voluntary savings)
    let sourceAccount = null;
    if (body.sourceAccountId) {
      sourceAccount = await db.account.findUnique({
        where: { id: body.sourceAccountId },
        include: { accountType: true },
      });

      if (!sourceAccount) {
        return NextResponse.json({ error: "Source account not found" }, { status: 404 });
      }

      if (body.memberId && sourceAccount.memberId !== body.memberId) {
        return NextResponse.json({ error: "Source account does not belong to this member" }, { status: 400 });
      }

      if (sourceAccount.memberId) {
        try {
          await assertMemberCanTransact(sourceAccount.memberId);
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Member is not eligible to transact yet" },
            { status: 400 },
          );
        }
      }

      if (body.institutionId && sourceAccount.institutionId !== body.institutionId) {
        return NextResponse.json({ error: "Source account does not belong to this institution" }, { status: 400 });
      }

      if (sourceAccount.balance < body.principalAmount) {
        return NextResponse.json(
          { error: `Insufficient balance. Available: ${sourceAccount.balance}, Required: ${body.principalAmount}` },
          { status: 400 }
        );
      }

      // Flag-based validation: must be an active withdrawable non-share non-fixed account
      if (
        !sourceAccount.accountType.canWithdraw ||
        sourceAccount.accountType.isShareAccount ||
        sourceAccount.accountType.hasFixedPeriod
      ) {
        return NextResponse.json(
          { error: "Fixed deposits can only be funded from Voluntary Savings accounts" },
          { status: 400 },
        );
      }
    }


    // Create fixed deposit with GL integration
    const fixedDeposit = await db.$transaction(async (tx) => {
      // 1. Create Fixed Deposit Record
      const fd = await tx.fixedDeposit.create({
        data: {
          accountNumber,
          memberId: body.memberId || null,
          institutionId: body.institutionId || null,
          branchId,
          principalAmount: body.principalAmount,
          interestRate: interestRate, // Auto-calculated from system config
          termMonths: body.termMonths,
          startDate,
          maturityDate,
          maturityAmount,
          autoRenew: body.autoRenew || false,
          fundingSourceAccountId: sourceAccount?.id || null,
        },
        include: {
          member: { select: { memberNumber: true, userId: true, user: { select: { id: true, name: true, email: true } } } },
          institution: { select: { institutionNumber: true, institutionName: true, userId: true } },
          branch: { select: { name: true } },
        },
      });

      // NEW: If source account provided, deduct balance from it
      if (sourceAccount) {
        await tx.account.update({
          where: { id: sourceAccount.id },
          data: { balance: { decrement: body.principalAmount } },
        });

        // Create transfer transaction record
        await tx.transaction.create({
          data: {
            transactionRef: `FD-TRANSFER-${Date.now()}`,
            accountId: sourceAccount.id,
            memberId: body.memberId || null,
            institutionId: body.institutionId || null,
            type: "TRANSFER",
            amount: body.principalAmount,
            status: "COMPLETED",
            description: body.description || `Transfer to fixed deposit - ${body.termMonths} months term`,
            processedByUserId: (session.user as any).id,
          },
        });
      }

      // 2. Journal Entry
      // For savings-to-FD transfer: Dr Savings Liability, Cr FD Liability (no new cash in)
      // For cash FD (no source account): Dr Cash, Cr FD Liability
      let debitGlAccount = cashAccount;

      if (sourceAccount) {
        // Look up the savings liability GL account for this account type
        const ledgerAccountId = (sourceAccount as any).accountType?.ledgerAccountId;
        const savingsLiabilityAccount = ledgerAccountId
          ? await tx.chartOfAccount.findUnique({ where: { id: ledgerAccountId } })
          : await tx.chartOfAccount.findFirst({
              where: {
                ledgerType: "LIABILITIES",
                accountName: { contains: "SAVINGS", mode: "insensitive" },
                isActive: true,
              },
            });

        if (savingsLiabilityAccount) {
          debitGlAccount = savingsLiabilityAccount;
        }
      }

      await tx.journalEntry.createMany({
        data: [
          {
            entryNumber,
            accountId: debitGlAccount.id,
            debitAmount: body.principalAmount,
            creditAmount: 0,
            description: sourceAccount
              ? `FD Transfer from Savings: ${fd.accountNumber}`
              : `FD Opening (Cash): ${fd.accountNumber}`,
            entryDate: new Date(),
            reference: transactionRef,
            branchId: branchId,
            createdByUserId: (session.user as any).id,
          },
          {
            entryNumber,
            accountId: fdLiabilityAccount.id,
            debitAmount: 0,
            creditAmount: body.principalAmount,
            description: `FD Principal: ${fd.member?.user.name || fd.institution?.institutionName}`,
            entryDate: new Date(),
            reference: transactionRef,
            branchId: branchId,
            createdByUserId: (session.user as any).id,
          },
        ],
      });

      // 3. Update GL Balances
      // Use the shared helper so the sign of `balance` respects the account's
      // normal side (a debit posting DECREASES balance on a credit-normal
      // LIABILITY/EQUITY/INCOME account like a savings ledger, and INCREASES
      // it on a debit-normal ASSET/EXPENDITURE account like cash).
      await tx.chartOfAccount.update({
        where: { id: debitGlAccount.id },
        data: buildAccountBalanceUpdate(debitGlAccount, { debitAmount: body.principalAmount }),
      });
      await tx.chartOfAccount.update({
        where: { id: fdLiabilityAccount.id },
        data: buildAccountBalanceUpdate(fdLiabilityAccount, { creditAmount: body.principalAmount }),
      });

      // 4. Send In-App Notification
      const userId = fd.member?.userId || fd.institution?.userId;
      if (userId) {
        await tx.notification.create({
          data: {
            userId: userId,
            type: "IN_APP",
            subject: "Fixed Deposit Opened",
            message: `New fixed deposit of UGX ${body.principalAmount.toLocaleString()} has been successfully opened (Account: ${accountNumber}). Term: ${body.termMonths} months at ${interestRate}% p.a. Maturity date: ${maturityDate.toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
            targetAddress: `/dashboard/accounts`,
            status: "SENT",
            sentAt: new Date()
          }
        });
      }

      return fd;
    });

    return NextResponse.json(
      { 
        data: fixedDeposit,
        message: "Fixed deposit created successfully" 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating fixed deposit:", error);
    return NextResponse.json(
      { error: "Failed to create fixed deposit" },
      { status: 500 }
    );
  }
}
