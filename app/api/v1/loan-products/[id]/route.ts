import { NextResponse } from "next/server";
import { LoanProductService } from "@/lib/services/loan-product";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const product = await LoanProductService.getDetailsById(id);
    if (!product) {
      return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const product = await LoanProductService.update(id, body);
    return NextResponse.json({ ok: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await LoanProductService.delete(id);
    return NextResponse.json({ ok: true, message: "Product deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
