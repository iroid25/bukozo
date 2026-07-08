import { NextResponse } from "next/server";

// Capture now happens in the browser via localhost:8001 (fingerprint bridge).
// This server route is no longer used — browser calls bridge directly.
export async function POST() {
  return NextResponse.json(
    { error: "Fingerprint bridge not running. Start fingerprint-bridge/server.js on this PC." },
    { status: 503 },
  );
}
