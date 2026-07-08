// actions/statements.ts
"use server";

import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import {
  createStatementRecord,
  getMemberStatementData as getMemberStatementDataService,
  getMembersForStatementGeneration,
} from "@/lib/services/statements";

export interface StatementCreateDTO {
  memberId: string;
  startDate: Date; // Changed from periodStart
  endDate?: Date; // Changed from periodEnd
}

export interface StatementUpdateDTO {
  id: string;
  pdfPath?: string; // Changed from fileUrl to match schema
}

// Fetch all statements with relations

// Fetch statements by member ID
export async function getStatementsByMemberId(memberId: string) {
  try {
    const statements = await db.statement.findMany({
      where: { memberId },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        user: {
          // Changed from generatedByUser
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });
    return statements;
  } catch (error) {
    console.error("Error fetching member statements:", error);
    return [];
  }
}

// Fetch single statement by ID
export async function getStatementById(id: string) {
  try {
    const statement = await db.statement.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        user: true, // Changed from generatedByUser
      },
    });
    return statement;
  } catch (error) {
    console.error("Error fetching statement:", error);
    return null;
  }
}

// Get member's statement data (transactions, accounts, etc.)
//

import { generateMemberStatementPDF } from "@/lib/reports/generators/member-statement-pdf";
import { uploadPDFToCloudinaryEnhanced } from "@/lib/cloudinary";
import { format } from "date-fns";

// Generate PDF statement
export async function generateStatementPDF(
  memberId: string,
  startDate: Date,
  endDate: Date
): Promise<string> {
  try {
    // Get statement data
    const statementData = await getMemberStatementData(
      memberId,
      startDate,
      endDate
    );

    // Generate PDF Buffer
    const pdfBuffer = await generateMemberStatementPDF(statementData, startDate, endDate);

    // Upload to Cloudinary
    const fileName = `statement_${memberId}_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`;
    const uploadResult = await uploadPDFToCloudinaryEnhanced(
      pdfBuffer,
      fileName,
      {
        memberNumber:
          statementData.member?.memberNumber ||
          statementData.institution?.institutionNumber ||
          "statement",
        periodStart: format(startDate, 'yyyy-MM-dd'),
        periodEnd: format(endDate, 'yyyy-MM-dd'),
      }
    );

    return uploadResult.url;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error(
      error instanceof Error
        ? `Failed to generate PDF statement: ${error.message}`
        : "Failed to generate PDF statement",
    );
  }
}

// Create new statement
export async function createStatement(
  data: StatementCreateDTO,
  userId: string // Changed from generatedByUserId
) {
  try {
    const authUser = await getAuthUser();
    const effectiveUser = authUser
      ? authUser
      : { id: userId, role: "ADMIN", branchId: null };

    const statement = await createStatementRecord(effectiveUser, data);

    revalidatePath("/dashboard/statements");
    revalidatePath(`/dashboard/members/${data.memberId}`);

    return statement;
  } catch (error) {
    console.error("Error creating statement:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate statement. Please try again.",
      data: null,
    };
  }
}

// Update statement file path
export async function updateStatementFilePath(data: StatementUpdateDTO) {
  try {
    const statement = await db.statement.update({
      where: { id: data.id },
      data: {
        pdfPath: data.pdfPath, // Changed from fileUrl
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        user: {
          // Changed from generatedByUser
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    revalidatePath("/dashboard/statements");
    revalidatePath(`/dashboard/members/${statement.memberId}`);

    return {
      error: null,
      data: statement,
    };
  } catch (error) {
    console.error("Error updating statement:", error);
    return {
      error: "Failed to update statement. Please try again.",
      data: null,
    };
  }
}

// Get statements by date range
export async function getStatementsByDateRange(startDate: Date, endDate: Date) {
  try {
    const statements = await db.statement.findMany({
      where: {
        generatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });
    return statements;
  } catch (error) {
    console.error("Error fetching statements by date range:", error);
    return [];
  }
}

// Get recent statements
export async function getRecentStatements(limit: number = 10) {
  try {
    const statements = await db.statement.findMany({
      take: limit,
      include: {
        member: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });
    return statements;
  } catch (error) {
    console.error("Error fetching recent statements:", error);
    return [];
  }
}

// Bulk generate statements for all members
export async function bulkGenerateStatements(
  startDate: Date,
  endDate: Date,
  userId: string
) {
  try {
    const members = await db.member.findMany({
      where: {
        isApproved: true,
      },
      select: {
        id: true,
        memberNumber: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const member of members) {
      try {
        const result = await createStatement(
          {
            memberId: member.id,
            startDate,
            endDate,
          },
          userId
        );

        if (result.error) {
          results.failed++;
          results.errors.push(
            `${member.user.name} (${member.memberNumber}): ${result.error}`
          );
        } else {
          results.successful++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${member.user.name} (${member.memberNumber}): Failed to generate`
        );
      }
    }

    revalidatePath("/dashboard/statements");

    return {
      error: null,
      data: results,
    };
  } catch (error) {
    console.error("Error bulk generating statements:", error);
    return {
      error: "Failed to bulk generate statements. Please try again.",
      data: null,
    };
  }
}
import { Statement, StatementData } from "@/types/statements";
/**
 * Get all statements with transformed data
 */
export async function getAllStatements(): Promise<Statement[]> {
  try {
    const statements = await db.statement.findMany({
      include: {
        member: {
          include: {
            user: true,
            accounts: {
              include: {
                accountType: true,
                branch: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    // Transform each statement to match the Statement interface
    return statements.map((statement) => ({
      ...statement,
      // Add computed/alias properties for backward compatibility
      statementDate: statement.generatedAt,
      periodStart: statement.startDate,
      periodEnd: statement.endDate || new Date(),
      fileUrl: statement.pdfPath,
      generatedByUserId: statement.userId,
      generatedByUser: statement.user
        ? {
            id: statement.user.id,
            name: statement.user.name,
            role: statement.user.role,
          }
        : null,
    })) as Statement[];
  } catch (error) {
    console.error("Failed to get all statements:", error);
    throw new Error("Failed to get all statements");
  }
}

/**
 * Get statement statistics
 */
export async function getStatementStatistics() {
  try {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisMonth, total] = await Promise.all([
      db.statement.count({
        where: {
          generatedAt: {
            gte: startOfDay,
          },
        },
      }),
      db.statement.count({
        where: {
          generatedAt: {
            gte: startOfMonth,
          },
        },
      }),
      db.statement.count(),
    ]);

    return {
      today,
      thisMonth,
      total,
    };
  } catch (error) {
    console.error("Failed to get statement statistics:", error);
    return {
      today: 0,
      thisMonth: 0,
      total: 0,
    };
  }
}

/**
 * Get members for statement generation
 */
export async function getMembersForStatements() {
  try {
    const user = await getAuthUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    return await getMembersForStatementGeneration(user);
  } catch (error) {
    console.error("Failed to get members for statements:", error);
    throw new Error("Failed to get members for statements");
  }
}

/**
 * Delete a statement
 */
export async function deleteStatement(statementId: string) {
  try {
    await db.statement.delete({
      where: { id: statementId },
    });

    return {
      success: true,
      message: "Statement deleted successfully",
    };
  } catch (error) {
    console.error("Failed to delete statement:", error);
    return {
      success: false,
      error: "Failed to delete statement",
    };
  }
}

/**
 * Get member statement data for a specific period
 */
export async function getMemberStatementData(
  memberId: string,
  startDate: Date,
  endDate: Date
): Promise<StatementData> {
  try {
    return await getMemberStatementDataService(memberId, startDate, endDate);
  } catch (error) {
    console.error("Failed to get member statement data:", error);
    throw new Error("Failed to get member statement data");
  }
}
