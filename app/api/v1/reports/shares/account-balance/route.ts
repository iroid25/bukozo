import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { ShareAccountBalanceGenerator } from '@/lib/reports/generators/share-account-balance';
import { resolveBranchScope } from '@/lib/services/branch-scope';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await request.json();
    const generator = new ShareAccountBalanceGenerator();
    const branchId = resolveBranchScope(session.user as any, params.branchId || undefined);
    const reportData = await generator.generateData({ ...params, branchId, user: session.user });

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `share_account_balance_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating share account balance:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
