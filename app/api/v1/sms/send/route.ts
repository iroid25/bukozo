import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";

const AT_API_KEY = process.env.AFRICASTALKING_API_KEY;
const AT_USERNAME = process.env.AFRICASTALKING_USERNAME || "sandbox";
const AT_SENDER_ID = process.env.AFRICASTALKING_SENDER_ID || "";

async function sendViaSMSProvider(phones: string[], message: string) {
  if (!AT_API_KEY) {
    throw new Error(
      "SMS provider not configured. Set AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME in environment variables.",
    );
  }

  const params = new URLSearchParams();
  params.append("username", AT_USERNAME);
  params.append("to", phones.join(","));
  params.append("message", message);
  if (AT_SENDER_ID) params.append("from", AT_SENDER_ID);

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey: AT_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SMS API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const recipients: any[] = data?.SMSMessageData?.Recipients ?? [];

  return recipients.map((r: any) => ({
    phone: r.number,
    status: r.statusCode === 101 ? "sent" : "failed",
    reason: r.statusCode !== 101 ? r.status : undefined,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER") {
      return NextResponse.json(
        { error: "Only admins and branch managers can send bulk SMS" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { recipients, message } = body as {
      recipients: string[];
      message: string;
    };

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients are required" }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const results = await sendViaSMSProvider(recipients, message);
    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const errors = results.filter((r) => r.reason).map((r) => `${r.phone}: ${r.reason}`);

    try {
      await db.notification.createMany({
        data: recipients.map((phone) => ({
          type: "SMS",
          message,
          targetAddress: phone,
          sentAt: new Date(),
          status: "SENT",
        })),
        skipDuplicates: true,
      });
    } catch {
      // audit log failure is non-fatal
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error: any) {
    const isConfig = error?.message?.includes("not configured");
    return NextResponse.json(
      { error: error.message || "Failed to send SMS messages" },
      { status: isConfig ? 503 : 500 },
    );
  }
}
