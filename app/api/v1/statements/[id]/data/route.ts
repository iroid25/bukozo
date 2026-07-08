import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { getAccessibleStatementById } from "@/services/report.service";
import {
  buildStatementDataForSubject,
  getInstitutionStatementAuditById,
  getStatementMetadata,
} from "@/lib/services/statements";

/**
 * GET /api/v1/statements/[id]/data
 * Get detailed statement data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get statement
    const statement =
      (await getAccessibleStatementById(user, id)) ||
      (await getInstitutionStatementAuditById(user, id));

    if (!statement) {
      return NextResponse.json(
        { error: "Statement not found" },
        { status: 404 }
      );
    }

    const metadata = await getStatementMetadata(id);

    const statementData = await buildStatementDataForSubject(user, {
      subjectType: metadata.subjectType,
      memberId: metadata.memberId ?? statement.memberId ?? undefined,
      institutionId: metadata.institutionId ?? undefined,
      accountId: metadata.accountId || undefined,
      scope: metadata.scope,
      startDate: statement.startDate,
      endDate: statement.endDate || new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      data: statementData 
    });
  } catch (error: any) {
    console.error("Error fetching statement data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch statement data" },
      { status: 500 }
    );
  }
}
