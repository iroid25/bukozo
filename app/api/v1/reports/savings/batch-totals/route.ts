import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/config/useAuth';
import { ReportExporter } from '@/lib/reports';
import { SavingsBatchTotalsGenerator, buildSavingsBatchTotalsWorkbook } from '@/lib/reports/generators/savings-batch-totals';

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
    const generator = new SavingsBatchTotalsGenerator();
    const reportData = await generator.generateData({ ...params, user });

    if (params.format && params.format !== 'JSON') {
      if (String(params.format).toLowerCase() === 'xlsx') {
        const buffer = await buildSavingsBatchTotalsWorkbook(reportData);
        return new NextResponse(Buffer.from(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="savings-batch-totals-${Date.now()}.xlsx"`,
          },
        });
      }

      return await ReportExporter.export(reportData, params.format, {
        filename: `savings_batch_totals_${Date.now()}`,
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating savings batch totals report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate savings batch totals report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
