import { NextRequest, NextResponse } from "next/server";
import { RelworxPaymentService } from "@/services/relworx-payment.service";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    try {
      await RelworxPaymentService.handleWebhook({
        status: payload.status,
        message: payload.message,
        customer_reference: payload.customer_reference || payload.reference,
        internal_reference: payload.internal_reference,
        msisdn: payload.msisdn,
        amount: payload.amount,
        currency: payload.currency,
        provider: payload.provider,
        charge: payload.charge,
        provider_transaction_id: payload.provider_transaction_id,
        completed_at: payload.completed_at,
        reference: payload.customer_reference || payload.reference,
      });
    } catch (error) {
      console.error("Relworx webhook processing error:", error);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Relworx webhook parse error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

