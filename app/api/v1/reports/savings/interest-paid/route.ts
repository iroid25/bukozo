import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { ReportExporter } from '@/lib/reports';
import { InterestPaidReportGenerator } from '@/lib/reports/generators/interest-paid-report';

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await request.json();
    const generator = new InterestPaidReportGenerator();
    const reportData = await generator.generateData(params);

    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `interest_paid_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating interest paid report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate interest paid report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
