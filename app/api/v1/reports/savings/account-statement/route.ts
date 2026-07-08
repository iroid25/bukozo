import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';
import { SavingsAccountStatementGenerator, buildSavingsAccountStatementWorkbook } from '@/lib/reports/generators/savings-account-statement';

export const dynamic = "force-dynamic";
export const revalidate = 0;


// GET /api/v1/reports/savings/account-statement
export async function GET(request: NextRequest) {
  return generateReport(request, 'GET');
}

// POST /api/v1/reports/savings/account-statement
export async function POST(request: NextRequest) {
  return generateReport(request, 'POST');
}

async function generateReport(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let params: any = {};

    if (method === 'GET') {
      const { searchParams } = new URL(request.url);
      params = Object.fromEntries(searchParams.entries());
    } else {
      try {
        const text = await request.text();
        params = text ? JSON.parse(text) : {};
      } catch (e) {
        console.warn('Failed to parse request body, using empty params', e);
        params = {};
      }
    }

    const generator = new SavingsAccountStatementGenerator();
    const reportData = await generator.generateData({ ...params, user: session.user });
    const report = reportData.data;

    if (params.format && params.format !== 'JSON') {
      const buffer = await buildSavingsAccountStatementWorkbook(report);
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="savings-account-statement-${report.member.accountNumber}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating savings account statement:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate savings account statement',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
