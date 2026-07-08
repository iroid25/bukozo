import { NextRequest, NextResponse } from "next/server";
import { TransactionType, TransactionStatus } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { ReportService } from "@/services/report.service";
import { createStatementRecord } from "@/lib/services/statements";
import { db } from "@/prisma/db";

const STATEMENT_FEE_GL_CODE = "405005";
const STATEMENT_FEE_GL_NAME = "Account Statement Fee";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const memberId = new URL(request.url).searchParams.get("memberId") || undefined;

    const result = await ReportService.getAllStatements(user);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    const data = memberId
      ? (result.data as any[]).filter((s) => s.member?.id === memberId || s.memberId === memberId)
      : result.data;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const subjectType =
      body.subjectType === "INSTITUTION" ? "INSTITUTION" : "MEMBER";
    const memberId =
      typeof body.memberId === "string" ? body.memberId.trim() : "";
    const institutionId =
      typeof body.institutionId === "string" ? body.institutionId.trim() : "";
    const accountId =
      typeof body.accountId === "string" ? body.accountId.trim() : undefined;
    const scope =
      body.scope === "SINGLE_ACCOUNT" ? "SINGLE_ACCOUNT" : "ALL_ACCOUNTS";
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;

    // Optional fee fields
    const statementFee = typeof body.statementFee === "number" && body.statementFee > 0
      ? body.statementFee
      : 0;
    const chargeAccountId =
      typeof body.chargeAccountId === "string" ? body.chargeAccountId.trim() : "";

    if (
      (!memberId && subjectType === "MEMBER") ||
      (!institutionId && subjectType === "INSTITUTION") ||
      !startDate ||
      Number.isNaN(startDate.getTime())
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            subjectType === "INSTITUTION"
              ? "Valid institutionId and startDate are required"
              : "Valid memberId and startDate are required",
        },
        { status: 400 },
      );
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid endDate supplied" },
        { status: 400 },
      );
    }

    // Deduct statement fee from the specified account before generating the statement
    if (statementFee > 0 && chargeAccountId) {
      const chargeAccount = await db.account.findFirst({
        where: { id: chargeAccountId, status: "ACTIVE" },
        include: { accountType: { include: { ledgerAccount: true } } },
      });

      if (!chargeAccount) {
        return NextResponse.json(
          { success: false, error: "Charge account not found or inactive" },
          { status: 400 },
        );
      }

      if (Number(chargeAccount.balance) < statementFee) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient balance to deduct statement fee. Available: ${Number(chargeAccount.balance).toLocaleString()}, Required: ${statementFee.toLocaleString()}`,
          },
          { status: 400 },
        );
      }

      const feeRef = `STMT-FEE-${Date.now()}`;

      await db.$transaction(async (tx) => {
        // Debit the savings liability account (DR) and credit the fee income account (CR)
        const savingsGlCode = chargeAccount.accountType?.ledgerAccount?.accountCode || "201003";
        const [savingsGlAccount, feeGlAccount] = await Promise.all([
          tx.chartOfAccount.findFirst({ where: { accountCode: savingsGlCode, isActive: true } }),
          tx.chartOfAccount.upsert({
            where: { accountCode: STATEMENT_FEE_GL_CODE },
            update: { accountName: STATEMENT_FEE_GL_NAME, isActive: true },
            create: {
              accountCode: STATEMENT_FEE_GL_CODE,
              accountName: STATEMENT_FEE_GL_NAME,
              fullCode: STATEMENT_FEE_GL_CODE,
              ledgerType: "INCOME",
              debitCredit: "CR",
              isActive: true,
              level: 2,
              category: "INCOME",
              description: "Fee charged when issuing account statements",
            },
          }),
        ]);

        if (savingsGlAccount) {
          const entryNumber = `JE-STMT-FEE-${Date.now()}`;
          const description = `Account statement fee — ${chargeAccount.accountNumber}`;

          await Promise.all([
            tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: savingsGlAccount.id,
                debitAmount: statementFee,
                creditAmount: 0,
                description,
                entryDate: new Date(),
                reference: feeRef,
                branchId: chargeAccount.branchId,
                createdByUserId: user.id,
              },
            }),
            tx.journalEntry.create({
              data: {
                entryNumber,
                accountId: feeGlAccount.id,
                debitAmount: 0,
                creditAmount: statementFee,
                description,
                entryDate: new Date(),
                reference: feeRef,
                branchId: chargeAccount.branchId,
                createdByUserId: user.id,
              },
            }),
          ]);
        }

        await tx.transaction.create({
          data: {
            transactionRef: feeRef,
            type: TransactionType.FEE,
            amount: statementFee,
            status: TransactionStatus.COMPLETED,
            description: `Account statement fee`,
            currency: "UGX",
            branchId: chargeAccount.branchId,
            memberId: chargeAccount.memberId ?? null,
            accountId: chargeAccount.id,
            processedByUserId: user.id,
            channel: "SYSTEM",
          },
        });

        await tx.account.update({
          where: { id: chargeAccount.id },
          data: { balance: { decrement: statementFee } },
        });
      });
    }

    const result = await createStatementRecord(user, {
      memberId: memberId || undefined,
      institutionId: institutionId || undefined,
      accountId,
      subjectType,
      scope,
      startDate,
      endDate: endDate || undefined,
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: true, data: result.data, feeCharged: statementFee },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
