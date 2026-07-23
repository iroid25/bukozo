import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { recipients, subject, message } = await request.json();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients are required" }, { status: 400 });
    }
    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const batchSize = 10;
    const results: PromiseSettledResult<any>[] = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (email: string) => {
          try {
            await resend.emails.send({
              from: EMAIL_FROM,
              to: email,
              subject,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">bukonzo Teachers SACCO</h1>
                  </div>
                  <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-bottom: 20px; font-size: 20px;">${subject}</h2>
                    <div style="line-height: 1.6; color: #555; font-size: 16px;">${message.replace(/\n/g, "<br>")}</div>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 14px; color: #888; text-align: center; margin: 0;">This email was sent from bukonzo Teachers SACCO</p>
                  </div>
                </div>
              `,
              text: `${subject}\n\n${message}\n\n---\nThis email was sent from bukonzo Teachers SACCO`,
            });
            return { success: true, email };
          } catch (error: any) {
            return { success: false, email, error: error.message };
          }
        }),
      );
      results.push(...batchResults);
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success,
    ).length;
    const failed = results.length - sent;
    const errors = results
      .filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as any).success))
      .map((r) => (r.status === "rejected" ? (r as any).reason?.message : (r.value as any).error));

    return NextResponse.json({ success: true, sent, failed, errors });
  } catch (error) {
    console.error("Error sending bulk email:", error);
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 });
  }
}
