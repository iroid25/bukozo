import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/config/useAuth';
import { ReportExporter } from '@/lib/reports';
import { OverdrawnAccountsGenerator } from '@/lib/reports/generators/overdrawn-accounts';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await request.json();
    params.branchId = user.role !== "ADMIN" ? user.branchId : (params.branchId || undefined);
    const generator = new OverdrawnAccountsGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `overdrawn_accounts_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating overdrawn accounts report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate overdrawn accounts report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
