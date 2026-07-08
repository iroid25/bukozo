import { NextRequest, NextResponse } from 'next/server';
import { getPesapalTransactionStatus, mapPesapalStatus } from '@/lib/pesapal';
import { db } from '@/prisma/db';

/**
 * GET /api/webhook?OrderTrackingId=xxx&OrderMerchantReference=xxx
 * Pesapal IPN (Instant Payment Notification) webhook handler
 * 
 * Pesapal sends notifications here when payment status changes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const merchantReference = searchParams.get('OrderMerchantReference');


    if (!orderTrackingId) {
      console.error('âŒ Missing OrderTrackingId in webhook');
      return NextResponse.json(
        { success: false, error: 'OrderTrackingId is required' },
        { status: 400 }
      );
    }

    // Check for force parameter (for testing only)
    const forceStatus = searchParams.get('force');
    
    // Get transaction status from Pesapal (unless forced)
    let status;
    let mappedStatus;
    
    if (forceStatus && (forceStatus === 'COMPLETED' || forceStatus === 'FAILED')) {
      mappedStatus = forceStatus;
      status = {
        status_code: forceStatus === 'COMPLETED' ? 1 : 2,
        merchant_reference: merchantReference || '',
        payment_status_description: 'Forced update via API',
        amount: 0 // Will be ignored if not used
      };
    } else {
      status = await getPesapalTransactionStatus(orderTrackingId);
      mappedStatus = mapPesapalStatus(status.status_code);
    }

    console.log("✅ Webhook status resolved", {
      orderTrackingId,
      status: mappedStatus,
      statusCode: status.status_code,
      amount: status.amount,
    });

    // Find the pending transaction in database
    const transaction = await db.transaction.findFirst({
      where: {
        transactionRef: merchantReference || status.merchant_reference,
      },
      include: {
        account: true,
        member: true,
      },
    });

    if (!transaction) {
      console.warn('âš ï¸ Transaction not found in database:', merchantReference);
      // Still return success to Pesapal
      return NextResponse.json({
        success: true,
        message: 'Webhook received but transaction not found',
      });
    }

    // Update transaction status based on Pesapal response
    let newStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED' = 'PENDING';
    
    switch (status.status_code) {
      case 1: // Completed
        newStatus = 'COMPLETED';
        break;
      case 2: // Failed
        newStatus = 'FAILED';
        break;
      case 3: // Reversed
        newStatus = 'REVERSED';
        break;
      default:
        newStatus = 'PENDING';
    }

    // Update the transaction
    const updatedTransaction = await db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: newStatus,
        description: `${transaction.description} - ${status.payment_status_description}`,
      },
    });

    // If completed, update account/loan balance
    if (newStatus === 'COMPLETED') {
      if (transaction.type === 'DEPOSIT' && transaction.accountId) {
        await db.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              increment: transaction.amount,
            },
          },
        });
      } else if (transaction.type === 'WITHDRAWAL' && transaction.accountId) {
        await db.account.update({
          where: { id: transaction.accountId },
          data: {
            balance: {
              decrement: transaction.amount,
            },
          },
        });
      } else if (transaction.type === 'LOAN_REPAYMENT' && transaction.loanId) {
        // Update loan balance
        await db.loan.update({
          where: { id: transaction.loanId },
          data: {
            outstandingBalance: {
              decrement: transaction.amount,
            },
            amountPaid: {
              increment: transaction.amount,
            },
          },
        });

        // Create loan repayment record
        if (transaction.memberId && transaction.member?.userId) {
          await db.loanRepayment.create({
            data: {
              loanId: transaction.loanId,
              memberId: transaction.memberId,
              amount: transaction.amount,
              repaymentDate: new Date(),
              handlerUserId: transaction.member.userId, // Self-service
              channel: 'MOBILE_MONEY',
              mobileMoneyRef: transaction.transactionRef,
            },
          });
        } else {
          console.warn('âš ï¸ Could not create loan repayment record: Missing memberId or userId');
        }
      }
    }

    // Create notification
    if (newStatus === 'COMPLETED' || newStatus === 'FAILED') {
      try {
        const userId = transaction.member?.userId || transaction.processedByUserId;
        
        if (userId) {
          await db.notification.create({
            data: {
              userId,
              type: 'IN_APP',
              subject: `Payment ${newStatus === 'COMPLETED' ? 'Successful' : 'Failed'}`,
              message: `Your ${transaction.type.toLowerCase()} of UGX ${transaction.amount.toLocaleString()} has ${newStatus === 'COMPLETED' ? 'been completed successfully' : 'failed'}.`,
              isRead: false,
              targetAddress: '/dashboard/member-details/deposit-details',
            },
          });
        }
      } catch (notifError) {
        console.error('âŒ Error creating notification:', notifError);
      }
    }

    console.log("✅ Webhook transaction updated", {
      id: updatedTransaction.id,
      status: newStatus,
      amount: updatedTransaction.amount,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: {
        transactionId: updatedTransaction.id,
        status: newStatus,
      },
    });
  } catch (error) {
    console.error('âŒ Error processing webhook:', error);
    // Return success to Pesapal even on error to prevent retries
    return NextResponse.json({
      success: true,
      message: 'Webhook received but processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/webhook
 * Alternative webhook handler for POST requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { OrderTrackingId, OrderMerchantReference } = body;


    // Redirect to GET handler logic
    const searchParams = new URLSearchParams({
      OrderTrackingId: OrderTrackingId || '',
      OrderMerchantReference: OrderMerchantReference || '',
    });

    const url = new URL(request.url);
    url.search = searchParams.toString();

    return GET(
      new NextRequest(url, {
        method: 'GET',
      })
    );
  } catch (error) {
    console.error('âŒ Error processing POST webhook:', error);
    return NextResponse.json({
      success: true,
      message: 'Webhook received but processing failed',
    });
  }
}
