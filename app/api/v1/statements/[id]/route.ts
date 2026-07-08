import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { getAccessibleStatementById } from "@/services/report.service";
import {
  getInstitutionStatementAuditById,
  getStatementMetadata,
} from "@/lib/services/statements";

/**
 * GET /api/v1/statements/[id]
 * Get a single statement by ID
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

    // Transform to match frontend expectations
    const transformedStatement = {
      ...statement,
      subjectType: metadata.subjectType,
      accountScope: metadata.scope,
      accountId: metadata.accountId,
      institutionId: metadata.institutionId,
      statementDate: statement.generatedAt,
      periodStart: statement.startDate,
      periodEnd: statement.endDate || new Date(),
      fileUrl: statement.pdfPath,
      generatedByUser: statement.user,
    };

    return NextResponse.json({ 
      success: true, 
      data: transformedStatement 
    });
  } catch (error: any) {
    console.error("Error fetching statement:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch statement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/statements/[id]
 * Delete a statement
 */
export async function DELETE(
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

    // Check if statement exists
    const statement =
      (await getAccessibleStatementById(user, id)) ||
      (await getInstitutionStatementAuditById(user, id));

    if (!statement) {
      return NextResponse.json(
        { error: "Statement not found" },
        { status: 404 }
      );
    }

    // Delete statement
    if (!["ADMIN", "ACCOUNTANT", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (statement.memberId) {
      await db.statement.delete({ where: { id } });
    } else {
      await db.auditLog.deleteMany({
        where: {
          entityType: "Statement",
          entityId: id,
          action: "STATEMENT_CREATED",
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Statement deleted successfully" 
    });
  } catch (error: any) {
    console.error("Error deleting statement:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete statement" },
      { status: 500 }
    );
  }
}
