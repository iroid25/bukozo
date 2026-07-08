import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { db } from '@/prisma/db';
import { LoanStatus } from '@prisma/client';

interface MigrationRow {
  rowNum: number;
  memberNumber: string;
  memberName?: string;
  productId?: string;
  amountGranted: number;
  outstandingBalance: number;
  dateDisbursed: string;
  period: number;
  rate: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and permissions
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (!["ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions. Only Admin, Branch Managers, and Loan Officers can migrate loans." },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { rows, officerId, productId } = body as {
      rows: MigrationRow[];
      officerId?: string;
      productId?: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No rows provided for migration' },
        { status: 400 }
      );
    }

    // Fetch all members and products for lookup
    const [members, products] = await Promise.all([
      db.member.findMany({
        select: {
          id: true,
          memberNumber: true,
          userId: true,
          user: { select: { name: true } }
        }
      }),
      db.loanProduct.findMany({
        where: { isActive: true },
        select: { id: true, name: true, interestRate: true }
      })
    ]);

    const results = {
      total: rows.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ rowNum: number; error: string }>,
    };

    // Process each row
    for (const row of rows) {
      try {
        // Find member by number or name
        let member = members.find(m =>
          m.memberNumber.toUpperCase() === row.memberNumber.toUpperCase()
        );

        if (!member && row.memberName) {
          member = members.find((m: any) =>
            m.user.name?.toUpperCase() === row.memberName?.toUpperCase()
          );
        }

        if (!member) {
          results.failed++;
          results.errors.push({
            rowNum: row.rowNum,
            error: `Member not found: ${row.memberNumber}`
          });
          continue;
        }

        // Determine product
        const product = productId
          ? products.find(p => p.id === productId)
          : row.productId
          ? products.find(p => p.id === row.productId)
          : products[0];

        if (!product) {
          results.failed++;
          results.errors.push({
            rowNum: row.rowNum,
            error: 'No valid product found'
          });
          continue;
        }

        // Calculate loan details
        const disbursementDate = new Date(row.dateDisbursed);
        const dueDate = new Date(disbursementDate);
        dueDate.setMonth(dueDate.getMonth() + row.period);

        const totalInterest = (row.amountGranted * row.rate * row.period) / (100 * 12);
        const totalAmountDue = row.amountGranted + totalInterest;

        // Create loan application
        const application = await db.loanApplication.create({
          data: {
            memberId: member.id,
            loanProductId: product.id,
            amountApplied: row.amountGranted,
            purpose: row.notes || 'Migrated Loan',
            status: LoanStatus.APPROVED,
            applicationDate: disbursementDate,
            approvalDate: disbursementDate,
            approverId: session.user.id,
            loanOfficerId: officerId || session.user.id,
          }
        });

        // Create loan record
        await db.loan.create({
          data: {
            loanApplicationId: application.id,
            memberId: member.id,
            amountGranted: row.amountGranted,
            interestRate: row.rate,
            interestAmount: totalInterest,
            totalAmountDue,
            outstandingBalance: row.outstandingBalance,
            disbursementDate,
            dueDate,
            status: row.outstandingBalance > 0 ? LoanStatus.DISBURSED : LoanStatus.REPAID,
          }
        });

        results.successful++;

      } catch (error: any) {
        console.error(`Error migrating row ${row.rowNum}:`, error);
        results.failed++;
        results.errors.push({
          rowNum: row.rowNum,
          error: error.message || 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to migrate loans'
      },
      { status: 500 }
    );
  }
}
