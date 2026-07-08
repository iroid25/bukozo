import { NextRequest, NextResponse } from "next/server";
import { Prisma, TransactionType, UserRole } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { buildAccountBalanceUpdate } from "@/lib/accounting-rules";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.ACCOUNTANT &&
      user.role !== UserRole.BRANCHMANAGER
    ) {
      return NextResponse.json(
        { error: "You do not have permission to approve advance requests." },
        { status: 403 },
      );
    }

    const { id } = await params;
    const rows = await db.$queryRaw<any[]>(
      Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
    );
    const advance = rows[0];

    if (!advance) return NextResponse.json({ error: "Advance request not found." }, { status: 404 });
    if (advance.status !== "PENDING") {
      return NextResponse.json(
        { error: "This advance request has already been processed." },
        { status: 409 },
      );
    }

    // Branch manager / accountant can only approve for their branch
    if (
      user.role !== UserRole.ADMIN &&
      user.branchId &&
      advance.branchId &&
      advance.branchId !== user.branchId
    ) {
      return NextResponse.json(
        { error: "You can only approve advance requests for your branch." },
        { status: 403 },
      );
    }

    const amount = Number(advance.amount);
    const isMemberAdvance = advance.advanceType === "MEMBER";

    // For member advances the funds go straight to their savings account — no float needed.
    // For staff/official advances validate and debit the initiating teller's float.
    let tellerFloat: { id: string; balance: number; isActiveForDay: boolean } | null = null;

    if (!isMemberAdvance) {
      tellerFloat = await db.userFloat.findUnique({
        where: { userId: advance.initiatedByUserId },
      });

      if (!tellerFloat) {
        return NextResponse.json(
          { error: "The teller who initiated this request does not have a float account." },
          { status: 400 },
        );
      }
      if (!tellerFloat.isActiveForDay) {
        return NextResponse.json(
          { error: "The initiating teller's float session is not active for today." },
          { status: 400 },
        );
      }
      if (tellerFloat.balance < amount) {
        return NextResponse.json(
          {
            error: `Insufficient float balance for the initiating teller. Available: ${tellerFloat.balance.toLocaleString()}, Required: ${amount.toLocaleString()}.`,
          },
          { status: 400 },
        );
      }
    }

    // For member advances: locate the member record (staffId is the User.id of the member)
    let memberSavingsAccount: { id: string; accountNumber: string } | null = null;
    if (isMemberAdvance && advance.staffId) {
      const memberRecord = await db.member.findFirst({
        where: { userId: advance.staffId },
        select: { id: true },
      });
      if (memberRecord) {
        memberSavingsAccount = await db.account.findFirst({
          where: {
            memberId: memberRecord.id,
            status: "ACTIVE",
            accountType: { name: { contains: "Voluntary", mode: "insensitive" } },
          },
          select: { id: true, accountNumber: true },
        });
      }
      if (!memberSavingsAccount) {
        return NextResponse.json(
          { error: "No active voluntary savings account found for this member. Please create one first." },
          { status: 400 },
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      // Look up GL accounts: 102005-Advances (Dr) and the credit side
      // For MEMBER advances: credit 201003 (Voluntary Savings); for others: credit 102001 (Cash at Hand)
      const [advancesAccount, cashAccount, voluntarySavingsGl] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { accountCode: "102005", isActive: true } }),
        tx.chartOfAccount.findFirst({ where: { accountCode: "102001", isActive: true } }),
        isMemberAdvance
          ? tx.chartOfAccount.findFirst({ where: { accountCode: "201003", isActive: true } })
          : Promise.resolve(null),
      ]);
      const creditGlAccount = isMemberAdvance ? (voluntarySavingsGl ?? cashAccount) : cashAccount;

      // Generate current asset code
      const countRows = await tx.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "FixedAsset" WHERE "assetType" = 'CURRENT'`,
      );
      const assetCode = `CA-${String(Number(countRows[0]?.count || 0) + 1).padStart(5, "0")}`;

      // Create the current asset record (advances category, approved)
      const assetRows = await tx.$queryRaw<any[]>(Prisma.sql`
        INSERT INTO "FixedAsset" (
          "id", "assetCode", "assetName", "category", "assetType",
          "purchaseDate", "purchasePrice", "currentValue",
          "depreciationRate", "usefulLifeYears", "salvageValue",
          "accumulatedDepreciation", "approvalStatus", "status",
          "branchId", "invoiceNumber", "officerName", "description",
          "quantity", "createdAt", "updatedAt"
        ) VALUES (
          ${crypto.randomUUID()}, ${assetCode},
          ${"Staff Advance - " + advance.staffName},
          'Advances', 'CURRENT',
          NOW(), ${amount}, ${amount},
          0, 0, 0, 0,
          'APPROVED', 'ACTIVE',
          ${advance.branchId || null},
          ${advance.requestCode},
          ${advance.staffName},
          ${advance.notes || `Staff advance: ${advance.reason}`},
          1, NOW(), NOW()
        )
        RETURNING *
      `);
      const asset = assetRows[0];

      // Post GL journal entry
      if (advancesAccount && creditGlAccount) {
        const entryNumber = `JE-ADV-${Date.now()}`;
        const description = isMemberAdvance
          ? `Member Advance to savings: ${advance.staffName} — ${advance.reason}`
          : `Staff Advance: ${advance.staffName} — ${advance.reason}`;
        const reference = advance.requestCode;
        const jeBranchId = advance.branchId || null;

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: advancesAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description,
            entryDate: new Date(),
            reference,
            branchId: jeBranchId,
            createdByUserId: user.id,
          },
        });

        await tx.journalEntry.create({
          data: {
            entryNumber,
            accountId: creditGlAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description,
            entryDate: new Date(),
            reference,
            branchId: jeBranchId,
            createdByUserId: user.id,
          },
        });

        await tx.chartOfAccount.update({
          where: { id: advancesAccount.id },
          data: buildAccountBalanceUpdate(advancesAccount, { debitAmount: amount }),
        });

        await tx.chartOfAccount.update({
          where: { id: creditGlAccount.id },
          data: buildAccountBalanceUpdate(creditGlAccount, { creditAmount: amount }),
        });
      }

      if (isMemberAdvance && memberSavingsAccount) {
        // Credit the member's voluntary savings account balance
        await tx.account.update({
          where: { id: memberSavingsAccount.id },
          data: { balance: { increment: amount } },
        });
      } else if (tellerFloat) {
        // Deduct from the teller's float (staff/official advances only)
        await tx.userFloat.update({
          where: { id: tellerFloat.id },
          data: { balance: { decrement: amount } },
        });

        // Record float transaction
        await tx.floatTransaction.create({
          data: {
            floatId: tellerFloat.id,
            type: TransactionType.FLOAT_PURCHASE,
            amount: -amount,
            description: `Advance to ${advance.staffName} [${advance.requestCode}]`,
            performedByUserId: user.id,
          },
        });
      }

      // Mark advance as ACTIVE
      await tx.$executeRaw(Prisma.sql`
        UPDATE "StaffAdvanceRequest"
        SET "status" = 'ACTIVE',
            "approvedById" = ${user.id},
            "approvedAt" = NOW(),
            "assetId" = ${asset.id},
            "updatedAt" = NOW()
        WHERE "id" = ${id}
      `);

      return tx.$queryRaw<any[]>(
        Prisma.sql`SELECT * FROM "StaffAdvanceRequest" WHERE "id" = ${id} LIMIT 1`,
      );
    });

    return NextResponse.json({ success: true, data: (result as any[])[0] });
  } catch (error: any) {
    console.error("Error approving staff advance:", error);
    return NextResponse.json(
      { error: "Failed to approve advance request", details: error.message },
      { status: 500 },
    );
  }
}
