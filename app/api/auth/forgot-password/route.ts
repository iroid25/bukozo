import { db } from "@/prisma/db";
import { generateToken } from "@/lib/token";
import { ResetPasswordEmail } from "@/components/email-templates/reset-password";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { EMAIL_FROM } from "@/lib/email";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return 404 or 200 to prevent enumeration? The action returned 404. I'll stick to that.
      return NextResponse.json(
        { error: "We cannot associate this email with any user" },
        { status: 404 },
      );
    }

    const token = generateToken(); // 6-digit OTP
    await db.user.update({
      where: { email },
      data: { token },
    });

    const userFirstname = user.firstName;

    let error = null;

    if (!resend) {
      console.warn(
        "⚠️ [MOCK EMAIL] RESEND_API_KEY is missing. Password reset token generated.",
      );
      console.log(`📨 [MOCK EMAIL] To: ${email} | Code: ${token}`);
    } else {
      const response = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: "Password Reset Code",
        react: ResetPasswordEmail({ userFirstname, token }),
      });
      error = response.error;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Verification code sent!" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error sending reset link:", error);
    return NextResponse.json(
      { error: "Failed to send reset link" },
      { status: 500 },
    );
  }
}
