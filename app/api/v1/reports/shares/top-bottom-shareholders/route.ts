import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { TopBottomShareholdersGenerator } from '@/lib/reports/generators/top-bottom-shareholders';
import { resolveBranchScope } from '@/lib/services/branch-scope';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await request.json();
    const generator = new TopBottomShareholdersGenerator();
    const branchId = resolveBranchScope(session.user as any, params.branchId || undefined);
    const reportData = await generator.generateData({ ...params, branchId });

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `top_bottom_shareholders_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating top/bottom shareholders:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate report', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
