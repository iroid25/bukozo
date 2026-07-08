import { NextRequest, NextResponse } from "next/server";
import { RelworxPaymentService } from "@/services/relworx-payment.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const internalReference =
      body.internalReference || body.internal_reference || body.transactionId;

    if (!internalReference) {
      return NextResponse.json(
        { success: false, error: "internalReference or transactionId is required" },
        { status: 400 },
      );
    }

    const result = await RelworxPaymentService.checkTransactionStatus(
      internalReference,
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Relworx verify error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

