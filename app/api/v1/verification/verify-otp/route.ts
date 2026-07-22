import { NextResponse } from "next/server"

declare global {
  var __otpStore: Map<string, { code: string; expiresAt: number }> | undefined
}

const otpStore = globalThis.__otpStore ?? new Map<string, { code: string; expiresAt: number }>()
if (typeof globalThis !== "undefined") globalThis.__otpStore = otpStore

setInterval(() => {
  const now = Date.now()
  for (const [key, val] of otpStore) {
    if (val.expiresAt < now) otpStore.delete(key)
  }
}, 60_000)

export async function POST(req: Request) {
  try {
    const { code, purpose, phone } = await req.json()

    if (!code) {
      return NextResponse.json({ error: "Verification code is required" }, { status: 400 })
    }

    const key = `${purpose || "general"}:${phone || ""}`
    let entry = otpStore.get(key)

    if (!entry && phone) {
      for (const [k, v] of otpStore) {
        if (k.endsWith(`:${phone}`) && v.code === code) { entry = v; break }
      }
    }

    if (!entry) {
      return NextResponse.json({ error: "No verification code found for this phone" }, { status: 400 })
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key)
      return NextResponse.json({ error: "Verification code has expired" }, { status: 400 })
    }

    if (entry.code !== code) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 })
    }

    otpStore.delete(key)

    return NextResponse.json({ success: true, message: "Verification successful" })
  } catch (error: any) {
    console.error("Error verifying code:", error)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
