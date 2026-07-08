import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: true });
  }

  const body = await req.json().catch(() => null);
  console.log("[camera-debug-server]", JSON.stringify(body, null, 2));

  return NextResponse.json({ ok: true });
}
