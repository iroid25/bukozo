
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Create Table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ChartOfAccount" (
        "id" TEXT NOT NULL,
        "accountCode" TEXT NOT NULL,
        "accountName" TEXT NOT NULL,
        "fullCode" TEXT NOT NULL,
        "parentId" TEXT,
        "level" INTEGER NOT NULL DEFAULT 3,
        "ledgerType" TEXT NOT NULL,
        "category" TEXT,
        "product" TEXT,
        "currency" TEXT NOT NULL DEFAULT 'UGX',
        "debitCredit" TEXT,
        "description" TEXT,
        "notes" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "isSystem" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "debitBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "creditBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    
        CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
      );
    `);

    // 2. Create Indices (Ignore if exists)
    try { await db.$executeRawUnsafe(`CREATE UNIQUE INDEX "ChartOfAccount_accountCode_key" ON "ChartOfAccount"("accountCode");`); } catch {}
    try { await db.$executeRawUnsafe(`CREATE INDEX "ChartOfAccount_accountCode_idx" ON "ChartOfAccount"("accountCode");`); } catch {}
    try { await db.$executeRawUnsafe(`CREATE INDEX "ChartOfAccount_ledgerType_idx" ON "ChartOfAccount"("ledgerType");`); } catch {}
    try { await db.$executeRawUnsafe(`CREATE INDEX "ChartOfAccount_parentId_idx" ON "ChartOfAccount"("parentId");`); } catch {}

    // 3. Add Foreign Key
    try {
        await db.$executeRawUnsafe(`
          ALTER TABLE "ChartOfAccount" 
          ADD CONSTRAINT "ChartOfAccount_parentId_fkey" 
          FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        `);
    } catch {}

    return NextResponse.json({ message: "Database schema for ChartOfAccount created successfully!" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
