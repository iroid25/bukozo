import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { successResponse, ApiErrors } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return ApiErrors.unauthorized();

    const { id: transactionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("historyLimit") || "10");

    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: {
        member: {
          include: {
            user: {
              select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, image: true },
            },
          },
        },
        institution: {
          select: {
            id: true, institutionNumber: true, institutionName: true, institutionEmail: true, institutionPhone: true,
            user: { select: { id: true, name: true, firstName: true, lastName: true, email: true, phone: true, image: true } },
          },
        },
        account: {
          include: {
            accountType: { select: { id: true, name: true, interestRate: true, minBalance: true } },
            branch: { select: { id: true, name: true, location: true } },
          },
        },
        processedByUser: {
          select: { id: true, name: true, firstName: true, lastName: true, role: true, email: true },
        },
        deposit: {
          include: {
            handler: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
          },
        },
        withdrawal: {
          include: {
            handler: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });

    if (!transaction) return ApiErrors.notFound("Transaction");

    // Related transactions
    const [reversals, fees, auditLog, accountHistory] = await Promise.all([
      db.transaction.findMany({
        where: {
          OR: [
            { relatedTransactionId: transactionId, type: "OTHER", description: { contains: "reversal", mode: "insensitive" } },
            { transactionRef: { startsWith: `REV-${transaction.transactionRef}` } },
          ],
        },
        include: {
          processedByUser: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
          member: { select: { memberNumber: true, user: { select: { name: true, firstName: true, lastName: true } } } },
          institution: { select: { institutionNumber: true, institutionName: true } },
        },
        orderBy: { transactionDate: "desc" },
      }),
      db.transaction.findMany({
        where: {
          OR: [
            { relatedTransactionId: transactionId, type: "FEE" },
            { transactionRef: { startsWith: `FEE-${transaction.transactionRef}` } },
          ],
        },
        include: {
          processedByUser: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { transactionDate: "desc" },
      }),
      db.auditLog.findMany({
        where: { entityType: "Transaction", entityId: transactionId },
        include: {
          user: { select: { id: true, name: true, firstName: true, lastName: true, role: true, email: true } },
        },
        orderBy: { timestamp: "desc" },
      }),
      db.transaction.findMany({
        where: { accountId: transaction.accountId, id: { not: transactionId } },
        include: {
          member: {
            select: {
              id: true, memberNumber: true,
              user: { select: { id: true, name: true, firstName: true, lastName: true } },
            },
          },
          institution: { select: { institutionNumber: true, institutionName: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: limit,
      }),
    ]);

    // Build related list
    const relatedIds = new Set([...reversals.map((r) => r.id), ...fees.map((f) => f.id)]);
    let related: any[] = [];
    if (transaction.relatedTransactionId) {
      const relatedTx = await db.transaction.findUnique({
        where: { id: transaction.relatedTransactionId },
        include: {
          processedByUser: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
          member: { select: { memberNumber: true, user: { select: { name: true, firstName: true, lastName: true } } } },
          institution: { select: { institutionNumber: true, institutionName: true } },
        },
      });
      if (relatedTx) related.push(relatedTx);
    }
    const referencingTxs = await db.transaction.findMany({
      where: { relatedTransactionId: transactionId, id: { notIn: [...relatedIds] } },
      include: {
        processedByUser: { select: { id: true, name: true, firstName: true, lastName: true, role: true } },
        member: { select: { memberNumber: true, user: { select: { name: true, firstName: true, lastName: true } } } },
        institution: { select: { institutionNumber: true, institutionName: true } },
      },
      orderBy: { transactionDate: "desc" },
    });
    related = [...related, ...referencingTxs];

    return successResponse({
      transaction,
      relatedData: { reversals, fees, related },
      auditLog,
      accountHistory,
    });
  } catch (error: any) {
    console.error("Error fetching transaction details:", error);
    return ApiErrors.internalError(error.message);
  }
}
