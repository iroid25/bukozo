// app/api/v1/loans/migrate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { LoanMigrationService, MigrationRow } from "@/services/loan-migration.service";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const userRole = (session.user as any).role;
        if (!["ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(userRole)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const data = await request.json();
        const { rows, officerId: defaultOfficerId, productId: defaultProductId, branchId: defaultBranchId } = data;
        
        if (!rows || !Array.isArray(rows)) {
            // Handle single migration if data is passed directly (fallback)
            const rowData = data.rows ? data.rows[0] : data;
            try {
                const result = await LoanMigrationService.migrateSingleLoan(
                    rowData, 
                    rowData.loanOfficerId || defaultOfficerId || session.user.id,
                    rowData.branchId || defaultBranchId
                );
                return NextResponse.json({ success: true, data: result }, { status: 201 });
            } catch (err: any) {
                return NextResponse.json({ success: false, error: err.message }, { status: 400 });
            }
        }

        // Batch Migration
        const migrationResults = [];
        for (const rowData of rows) {
            try {
                const row: MigrationRow = {
                    ...rowData,
                    loanProductId: rowData.loanProductId || defaultProductId,
                };

                const result = await LoanMigrationService.migrateSingleLoan(
                    row, 
                    rowData.loanOfficerId || defaultOfficerId || session.user.id,
                    rowData.branchId || defaultBranchId
                );

                migrationResults.push({
                    rowNum: rowData.rowNum,
                    success: true,
                    loanId: result.id
                });
            } catch (error: any) {
                migrationResults.push({
                    rowNum: rowData.rowNum,
                    success: false,
                    error: error.message
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${migrationResults.length} rows`,
            results: migrationResults
        });

    } catch (error: any) {
        console.error("Migration fatal error:", error);
        return NextResponse.json({ error: error.message || "Failed to process migration" }, { status: 500 });
    }
}
