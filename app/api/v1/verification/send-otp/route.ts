import { NextResponse } from "next/server"
import { generateOTP } from "@/lib/generateOTP"
import { sendSMS } from "@/lib/sms"

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
    const { phone, purpose } = await req.json()

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 })
    }

    const code = generateOTP()
    const expiresAt = Date.now() + 10 * 60 * 1000

    otpStore.set(`${purpose || "general"}:${phone}`, { code, expiresAt })

    const smsResult = await sendSMS(phone, `Your verification code is: ${code}. Valid for 10 minutes. Do not share this code. - Bukonzo Teachers SACCO`)

    if (!smsResult.success) {
      return NextResponse.json({ error: smsResult.error || "Failed to send SMS" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Verification code sent" })
  } catch (error: any) {
    console.error("Error sending verification code:", error)
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 })
  }
}
