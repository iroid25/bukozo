import { NextResponse } from "next/server";
import { getAuthUser } from "@/config/useAuth";
import { LoanProductService } from "@/lib/services/loan-product";

export async function GET() {
  try {
    const products = await LoanProductService.getAll();
    return NextResponse.json({ ok: true, data: products });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (!["ADMIN", "BRANCHMANAGER"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const product = await LoanProductService.create(body);
    return NextResponse.json({ ok: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
}
