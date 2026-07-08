import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { TransactionService } from "@/services/transaction.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role check: Only Tellers and Agents can process transactions for now
    if (!["TELLER", "AGENT", "ADMIN"].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: "You do not have permission to process withdrawals" },
        { status: 403 }
      );
    }

    const data = await request.json();

    const result = await TransactionService.processWithdrawal(data, user.id);

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: "Withdrawal processed successfully"
    });
  } catch (error) {
    console.error("Withdrawal API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId") || undefined;
    const branchId = ["ADMIN", "SUPERADMIN"].includes(user.role) 
      ? (searchParams.get("branchId") || undefined)
      : user.branchId || undefined;

    const result = await TransactionService.getWithdrawals({ 
      branchId, 
      memberId,
      take: Number(searchParams.get("take")) || 50,
      skip: Number(searchParams.get("skip")) || 0
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

