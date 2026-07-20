import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/config/useAuth';
import { resolveBranchScope } from '@/lib/services/branch-scope';
import { ReportExporter } from '@/lib/reports';
import { DormantAccountsGenerator } from '@/lib/reports/generators/dormant-accounts';

export const dynamic = "force-dynamic";
export const revalidate = 0;


/**
 * POST /api/v1/reports/savings/dormant-accounts
 * Generate dormant accounts report
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await request.json();
    params.branchId = resolveBranchScope(user, params.branchId);
    const generator = new DormantAccountsGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `dormant_accounts_${Date.now()}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating dormant accounts report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate dormant accounts report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
