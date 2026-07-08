
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getAuthUser();
    // Allow any authenticated user to fetch fee settings for display purposes? 
    // Or strictly ADMIN/ACCOUNTANT? 
    // server action in `fees.ts` checked for read? No, `getFeeSettings` just checked `getAuthUser`.
    // `updateFeeSettings` checked role.
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accountTypes = await db.accountType.findMany({
      select: {
        id: true,
        name: true,
        monthlyCharge: true,
        flatWithdrawalFee: true,
        withdrawalFeeTiers: true,
        minBalance: true, // Including minBalance as it's relevant for available amounts
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: accountTypes });
  } catch (error) {
    console.error("Error fetching fee settings:", error);
    return NextResponse.json(
      { error: "Failed to load fee settings" },
      { status: 500 }
    );
  }
}
