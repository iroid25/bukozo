import { NextResponse } from "next/server";
import { LoanProductService } from "@/lib/services/loan-product";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const stats = await LoanProductService.getStats(id);

    return NextResponse.json({ ok: true, data: stats });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to fetch loan product stats" },
      { status: 500 }
    );
  }
}
