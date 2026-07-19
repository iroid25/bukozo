// @ts-nocheck 
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/config/useAuth';
import { ReportExporter } from '@/lib/reports';
import { SavingsAccountBalanceGenerator } from '@/lib/reports/generators/savings-account-balance';

export const dynamic = "force-dynamic";
export const revalidate = 0;


/**
 * POST /api/v1/reports/savings/account-balance
 * Generate savings account balance report
 */
// GET /api/v1/reports/savings/account-balance
export async function GET(request: NextRequest) {
  return generateReport(request, 'GET');
}

// POST /api/v1/reports/savings/account-balance
export async function POST(request: NextRequest) {
  return generateReport(request, 'POST');
}

async function generateReport(request: NextRequest, method: 'GET' | 'POST') {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    params.branchId = user.role !== "ADMIN" ? user.branchId : (params.branchId || undefined);
    // Generate report
    const generator = new SavingsAccountBalanceGenerator();
    const reportData = await generator.generateData(params);

    // Export in requested format
    if (params.format && params.format !== 'JSON') {
      return await ReportExporter.export(reportData, params.format, {
        filename: `savings_account_balance_${Date.now()}`,
      });
    }

    // Return JSON by default
    return NextResponse.json({
      success: true,
      data: reportData,
    });
  } catch (error) {
    console.error('Error generating savings account balance report:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate savings account balance report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
