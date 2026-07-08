import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const codes = ["107000", "401000", "102001", "401300", "301004"];
    const accounts = await db.chartOfAccount.findMany({
      where: { accountCode: { in: codes } }
    });
    
    const results = codes.reduce((acc, code) => {
        const found = accounts.find(a => a.accountCode === code);
        acc[code] = found ? { id: found.id, name: found.accountName } : "MISSING";
        return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
        success: true,
        accounts: results,
        allFound: !Object.values(results).includes("MISSING")
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
