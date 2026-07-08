import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { ZeroBalanceAccountsGenerator } from '@/lib/reports/generators/zero-balance-accounts';

export const dynamic = "force-dynamic";
export const revalidate = 0;


/**
 * POST /api/v1/reports/savings/zero-balance
 * Generate zero balance accounts report
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await request.json();
    const generator = new ZeroBalanceAccountsGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `zero_balance_accounts_${Date.now()}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating zero balance accounts report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate zero balance accounts report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
