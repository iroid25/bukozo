import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    const { accountName, description, parentId } = await request.json();

    if (!accountName || !parentId) {
      return NextResponse.json({ error: 'Account name and parent category are required.' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // 1. Find the parent account
      const parentAccount = await tx.chartOfAccount.findUnique({
        where: { id: parentId }
      });

      if (!parentAccount) {
        throw new Error(`Parent account not found.`);
      }

      // 2. Generate new account code
      // We want to generate a code like 503500 (if 503400 was last)
      // Or 500101 if it's a child of 500100
      
      const lastChild = await tx.chartOfAccount.findFirst({
        where: { parentId: parentAccount.id },
        orderBy: { accountCode: 'desc' }
      });

      let newCode: string;
      if (lastChild) {
        // Increment last child's code
        // Handle logic for codes like 503400 -> 503500
        const codeNum = parseInt(lastChild.accountCode);
        // If parent is 500000 and children are 501000, 502000, next is 503000
        // But if children are 500100, 500200, next is 500300
        // We need to be careful with increments to not overlap levels
        if (parentAccount.level === 1) {
            newCode = (codeNum + 100).toString().padStart(6, '0');
        } else {
            newCode = (codeNum + 1).toString().padStart(6, '0');
        }
      } else {
        // First child
        const baseCode = parentAccount.accountCode;
        if (parentAccount.level === 1) {
            // 500000 -> 500100
            newCode = (parseInt(baseCode) + 100).toString().padStart(6, '0');
        } else {
            // 500100 -> 500101
            newCode = (parseInt(baseCode) + 1).toString().padStart(6, '0');
        }
      }

      // 3. Create Chart of Account
      const coaAccount = await tx.chartOfAccount.create({
        data: {
          accountName,
          accountCode: newCode,
          fullCode: newCode,
          ledgerType: "EXPENDITURES",
          debitCredit: "DR",
          isActive: true,
          level: parentAccount.level + 1,
          parentId: parentAccount.id,
          description: description || `Expenditure account: ${accountName}`,
          category: parentAccount.category || parentAccount.accountName
        }
      });

      // 4. Create ExpenditureCategory for compatibility
      await tx.expenditureCategory.create({
        data: {
          name: accountName,
          code: `EXP-${newCode}`,
          kind: "EXPENSE",
          description: description,
          isActive: true
        }
      });

      return coaAccount;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error creating expenditure account:", error);
    return NextResponse.json(
      { error: "Failed to create expenditure account", details: error.message },
      { status: 500 }
    );
  }
}
