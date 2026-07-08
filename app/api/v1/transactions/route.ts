import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { TransactionService } from "@/services/transaction.service";
import { TransactionType, TransactionStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as TransactionType | null;
    const status = searchParams.get("status") as TransactionStatus | null;
    const memberId = searchParams.get("memberId") || undefined;
    const take = parseInt(searchParams.get("limit") || "50");
    const skip = parseInt(searchParams.get("offset") || "0");

    let branchId = searchParams.get("branchId") || undefined;
    if (["TELLER", "BRANCHMANAGER"].includes(user.role) && user.branchId) {
        branchId = user.branchId;
    }

    const result = await TransactionService.getAllTransactions({
        branchId,
        memberId,
        type: type || undefined,
        status: status || undefined,
        take,
        skip
    });

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { type, ...data } = body;

    let result;
    if (type === TransactionType.WITHDRAWAL) {
      result = await TransactionService.processWithdrawal(data, user.id);
    } else if (type === TransactionType.DEPOSIT) {
      result = await TransactionService.processDeposit(data, user.id);
    } else {
      return NextResponse.json({ success: false, error: "Invalid transaction type" }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
