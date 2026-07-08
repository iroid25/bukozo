import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { ShareOnHoldClosedGenerator } from '@/lib/reports/generators/share-on-hold-closed';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await request.json();
    const generator = new ShareOnHoldClosedGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `share_on_hold_closed_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating share on hold/closed status report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate share on hold/closed status report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
