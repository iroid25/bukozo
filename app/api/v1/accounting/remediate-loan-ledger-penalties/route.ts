import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import {
  getLoanLedgerPenaltySyncSnapshot,
  remediateMissingLoanPenaltyLedgerEntries,
} from "@/lib/services/loan-ledger";

export const dynamic = "force-dynamic";

function canManage(user: { role?: string } | null) {
  return !!user && ["ADMIN", "ACCOUNTANT"].includes(user.role || "");
}

export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!canManage(user)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const data = await getLoanLedgerPenaltySyncSnapshot();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error loading loan ledger penalty remediation preview:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load remediation preview",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!canManage(user)) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const data = await remediateMissingLoanPenaltyLedgerEntries(user.id);

    return NextResponse.json({
      success: true,
      data,
      message: "Loan ledger penalty remediation completed",
    });
  } catch (error) {
    console.error("Error remediating loan ledger penalties:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to remediate loan ledger penalties",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
