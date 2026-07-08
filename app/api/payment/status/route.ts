import { NextRequest, NextResponse } from 'next/server';
import { getPesapalTransactionStatus, mapPesapalStatus } from '@/lib/pesapal';

/**
 * GET /api/payment/status?transactionId=xxx
 * Checks the status of a Pesapal transaction
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transactionId = searchParams.get('transactionId');

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get status from Pesapal
    const status = await getPesapalTransactionStatus(transactionId);

    // Map status code to readable format
    const mappedStatus = mapPesapalStatus(status.status_code);

    return NextResponse.json({
      success: true,
      data: {
        transactionId,
        status: mappedStatus,
        statusCode: status.status_code,
        paymentMethod: status.payment_method,
        amount: status.amount,
        currency: status.currency,
        confirmationCode: status.confirmation_code,
        paymentAccount: status.payment_account,
        description: status.description,
        merchantReference: status.merchant_reference,
        createdDate: status.created_date,
        statusDescription: status.payment_status_description,
      },
    });
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check payment status',
      },
      { status: 500 }
    );
  }
}
