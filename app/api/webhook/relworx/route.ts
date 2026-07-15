import { NextRequest, NextResponse } from "next/server";
import { RelworxPaymentService } from "@/services/relworx-payment.service";
import { verifyRelworxWebhookSignature } from "@/services/relworx-signature.util";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    const customerReference = payload.customer_reference || payload.reference;
    if (!payload.status || !customerReference || !payload.internal_reference) {
      console.warn("Relworx webhook payload missing required fields", payload);
      // Still return 200 — a malformed payload retried repeatedly won't fix itself.
      return NextResponse.json({ success: true, ignored: "malformed payload" }, { status: 200 });
    }

    const signatureCheck = verifyRelworxWebhookSignature(
      request.headers.get("relworx-signature"),
      {
        status: payload.status,
        customer_reference: customerReference,
        internal_reference: payload.internal_reference,
      },
    );

    if (signatureCheck.result === "invalid") {
      console.warn(`Relworx webhook signature rejected for reference ${customerReference}: ${signatureCheck.reason}`);
      return NextResponse.json({ success: false, error: "invalid signature" }, { status: 401 });
    }

    if (signatureCheck.result === "skipped") {
      console.warn(signatureCheck.reason);
    }

    try {
      await RelworxPaymentService.handleWebhook({
        status: payload.status,
        message: payload.message,
        customer_reference: customerReference,
        internal_reference: payload.internal_reference,
        msisdn: payload.msisdn,
        amount: payload.amount,
        currency: payload.currency,
        provider: payload.provider,
        charge: payload.charge,
        provider_transaction_id: payload.provider_transaction_id,
        completed_at: payload.completed_at,
        reference: customerReference,
      });
    } catch (error) {
      console.error("Relworx webhook processing error:", error);
      // Return 500 deliberately here (not 200) so Relworx retries — this is an
      // infra failure (e.g. DB down), not a bad payload.
      return NextResponse.json({ success: false, error: "internal error" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Relworx webhook parse error:", error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

