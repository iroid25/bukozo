import { NextResponse } from "next/server";
import {
  getAccountingSyncState,
  bumpAccountingSyncState,
} from "@/lib/services/accounting-sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const state = await getAccountingSyncState();
  return NextResponse.json(
    { success: true, data: state },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  const state = await bumpAccountingSyncState("Manual accounting sync refresh");
  return NextResponse.json(
    { success: true, data: state },
    { headers: { "Cache-Control": "no-store" } },
  );
}
