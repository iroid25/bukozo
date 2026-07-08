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

    // Generate account code (e.g., if parent is 301000 and has 2 children, next is 301003)
    const currentChildrenCount = parentAccount.children.length;
    const nextCode = parseInt(parentAccount.accountCode) + currentChildrenCount + 1;

    const newAccount = await prisma.chartOfAccount.create({
      data: {
        accountCode: nextCode.toString(),
        accountName,
        fullCode: `${nextCode} ${accountName}`,
        description,
        parentId,
        level: parentAccount.level + 1,
        ledgerType: "EQUITY",
        currency: "UGX",
        debitCredit: "CR", // Equity is typically Credit
        isActive: true,
      }
    });

    return NextResponse.json({ data: newAccount });
  } catch (error) {
    console.error("Error creating equity account:", error);
    return NextResponse.json(
      { error: "Failed to create equity account" },
      { status: 500 }
    );
  }
}
