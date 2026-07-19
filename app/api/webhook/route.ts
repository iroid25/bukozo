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

    // Wrap status update + balance changes in a transaction for idempotency.
    // Conditional updateMany prevents double-credit on duplicate webhook calls.
    const updatedTransaction = await db.$transaction(async (tx) => {
      const flipped = await tx.transaction.updateMany({
        where: {
          id: transaction.id,
          status: { not: newStatus },
        },
        data: {
          status: newStatus,
          description: `${transaction.description} - ${status.payment_status_description}`,
        },
      });

      // If already in target status, skip balance changes (idempotent)
      if (flipped.count === 0) return transaction;

      if (newStatus === 'COMPLETED') {
        if (transaction.type === 'DEPOSIT' && transaction.accountId) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { increment: transaction.amount } },
          });
        } else if (transaction.type === 'WITHDRAWAL' && transaction.accountId) {
          await tx.account.update({
            where: { id: transaction.accountId },
            data: { balance: { decrement: transaction.amount } },
          });
        } else if (transaction.type === 'LOAN_REPAYMENT' && transaction.loanId) {
          // Idempotent loan balance update — only decrement if sufficient balance
          const loan = await tx.loan.findUnique({ where: { id: transaction.loanId } });
          if (loan && loan.outstandingBalance >= transaction.amount) {
            await tx.loan.update({
              where: { id: transaction.loanId },
              data: {
                outstandingBalance: { decrement: transaction.amount },
                amountPaid: { increment: transaction.amount },
              },
            });
          }

          // Create loan repayment record (skip if one already exists for this ref)
          const existingRepayment = await tx.loanRepayment.findFirst({
            where: { mobileMoneyRef: transaction.transactionRef },
          });
          if (!existingRepayment && transaction.memberId && transaction.member?.userId) {
            await tx.loanRepayment.create({
              data: {
                loanId: transaction.loanId,
                memberId: transaction.memberId,
                amount: transaction.amount,
                repaymentDate: new Date(),
                handlerUserId: transaction.member.userId,
                channel: 'MOBILE_MONEY',
                mobileMoneyRef: transaction.transactionRef,
              },
            });
          }
        }
      }

      return await tx.transaction.findUnique({ where: { id: transaction.id } }) || transaction;
    });

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
