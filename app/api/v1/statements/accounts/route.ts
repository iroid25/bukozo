import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import {
  getAccountsForStatementSubject,
  type StatementSubjectType,
} from "@/lib/services/statements";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subjectType = (searchParams.get("subjectType") || "MEMBER") as StatementSubjectType;
    const subjectId = searchParams.get("subjectId");

    if (!subjectId) {
      return NextResponse.json(
        { error: "subjectId is required" },
        { status: 400 },
      );
    }

    const accounts = await getAccountsForStatementSubject(
      user,
      subjectType,
      subjectId,
    );

    return NextResponse.json({
      success: true,
      data: accounts,
    });
  } catch (error: any) {
    console.error("Error fetching statement accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch accounts" },
      { status: 500 },
    );
  }
}
