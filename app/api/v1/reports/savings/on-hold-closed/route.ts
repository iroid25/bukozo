import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { OnHoldClosedStatusGenerator } from '@/lib/reports/generators/on-hold-closed-status';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await request.json();
    const generator = new OnHoldClosedStatusGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `on_hold_closed_status_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating on hold/closed status report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate on hold/closed status report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
