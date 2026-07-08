import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import {
  buildStatementDataForSubject,
  type StatementScope,
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
    const scope = (searchParams.get("scope") || "ALL_ACCOUNTS") as StatementScope;
    const memberId = searchParams.get("memberId") || undefined;
    const institutionId = searchParams.get("institutionId") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    const data = await buildStatementDataForSubject(user, {
      subjectType,
      scope,
      memberId,
      institutionId,
      accountId,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data,
      statement: {
        id: `preview-${Date.now()}`,
        subjectType,
        accountScope: scope,
        accountId: accountId || null,
        institutionId: institutionId || null,
        memberId: memberId || null,
        startDate,
        endDate,
        generatedAt: new Date().toISOString(),
        pdfPath: null,
        fileUrl: null,
        statementDate: new Date().toISOString(),
        periodStart: startDate,
        periodEnd: endDate,
        generatedByUser: {
          id: user.id,
          name: (user as any).name || "System",
          role: user.role,
        },
      },
    });
  } catch (error: any) {
    console.error("Error generating statement preview:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate preview" },
      { status: 500 },
    );
  }
}
