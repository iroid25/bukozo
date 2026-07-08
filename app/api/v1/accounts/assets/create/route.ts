import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db as prisma } from "@/prisma/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountName, description, parentId } = body;

    if (!accountName || !parentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get parent account to determine next code and level
    const parentAccount = await prisma.chartOfAccount.findUnique({
      where: { id: parentId },
      include: { children: true }
    });

    if (!parentAccount) {
      return NextResponse.json({ error: "Parent account not found" }, { status: 404 });
    }

    // Generate account code
    const currentChildrenCount = parentAccount.children.length;
    const nextCodeNum = parseInt(parentAccount.accountCode) + currentChildrenCount + 1;
    const nextCode = nextCodeNum.toString();

    const newAccount = await prisma.chartOfAccount.create({
      data: {
        accountCode: nextCode,
        accountName,
        fullCode: `${nextCode} ${accountName}`,
        description,
        parentId,
        level: parentAccount.level + 1,
        ledgerType: "ASSETS",
        currency: "UGX",
        debitCredit: "DR", // Assets are typically Debit
        isActive: true,
      }
    });

    return NextResponse.json({ data: newAccount });
  } catch (error) {
    console.error("Error creating asset account:", error);
    return NextResponse.json(
      { error: "Failed to create asset account" },
      { status: 500 }
    );
  }
}
