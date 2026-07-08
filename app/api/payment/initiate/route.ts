import { NextRequest, NextResponse } from 'next/server';
import { submitPesapalOrder } from '@/lib/pesapal';
import { db } from '@/prisma/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/config/auth';

/**
 * POST /api/payment/initiate
 * Initiates a Pesapal payment and returns checkout URL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      phoneNumber,
      amount,
      accountId,
      transactionType = 'deposit',
      loanId,
      description,
    } = body;

    // Validation
    if (!phoneNumber || !amount) {
      return NextResponse.json(
        { success: false, error: 'Phone number and amount are required' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Validate phone number format (Uganda: 0700123456)
    const phoneRegex = /^0[7][0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format (e.g., 0700123456)' },
        { status: 400 }
      );
    }

    // Get user details
    const user = await db.user.findUnique({
      where: { email: session.user.email! },
      include: { member: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate unique merchant reference
    const timestamp = Date.now();
    const merchantReference = `${transactionType.toUpperCase()}-${timestamp}`;

    // Prepare order description
    let orderDescription = description || `${transactionType} payment`;
    if (transactionType === 'deposit' && accountId) {
      const account = await db.account.findUnique({
        where: { id: accountId },
        include: { accountType: true },
      });
      if (account) {
        orderDescription = `Deposit to ${account.accountType.name} - ${account.accountNumber}`;
      }
    } else if (transactionType === 'repayment' && loanId) {
      const loan = await db.loan.findUnique({
        where: { id: loanId },
      });
      if (loan) {
        orderDescription = `Loan repayment for Loan ID: ${loan.id.substring(0, 8)}`;
      }
    }

    // Submit order to Pesapal
    const pesapalResponse = await submitPesapalOrder({
      merchantReference,
      amount,
      description: orderDescription,
      phoneNumber,
      email: user.email || undefined,
      firstName: user.member?.otherNames || user.name?.split(' ')[0] || 'Customer',
      lastName: user.member?.surname || user.name?.split(' ')[1] || '',
    });

    // Store pending transaction in database for tracking
    const pendingTransaction = await db.transaction.create({
      data: {
        transactionRef: merchantReference,
        type: transactionType === 'deposit' 
          ? 'DEPOSIT' 
          : transactionType === 'repayment' 
            ? 'LOAN_REPAYMENT' 
            : 'WITHDRAWAL',
        amount,
        description: orderDescription,
        status: 'PENDING',
        channel: 'MOBILE_MONEY',
        accountId: accountId || null,
        memberId: user.member?.id || null,
        loanId: loanId || null,
        // Store Pesapal tracking ID in description for now
        // You may want to add a dedicated field in your schema
      },
    });

    console.log('✅ Payment initiated:', {
      merchantReference,
      orderTrackingId: pesapalResponse.order_tracking_id,
      transactionId: pendingTransaction.id,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: pesapalResponse.redirect_url,
      transactionId: pesapalResponse.order_tracking_id,
      merchantReference,
      message: 'Payment initiated successfully. Redirecting to Pesapal...',
    });
  } catch (error) {
    console.error('❌ Error initiating payment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate payment',
      },
      { status: 500 }
    );
  }
}
