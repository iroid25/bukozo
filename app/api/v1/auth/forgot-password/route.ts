import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { randomBytes } from "crypto";
import { EMAIL_FROM } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 },
      );
    }

    const user = await db.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Return success even if user not found to prevent enumeration
      return NextResponse.json({
        success: true,
        message: "If an account exists, a reset code has been sent.",
      });
    }

    // Generate token
    const token = randomBytes(3).toString("hex").toUpperCase(); // 6 char hex
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    });

    // Send actual email using Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY!);

      const { default: ResetPasswordEmail } =
        await import("@/components/email-templates/reset-password");

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: "Password Reset Code",
        react: ResetPasswordEmail({ userFirstname: user.firstName, token }),
      });

      if (error) {
        console.error("Email sending error:", error);
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] Password Reset Token for ${email}: ${token}`);
        }
      } else {
        console.log("Password reset email sent successfully:", data);
      }
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV] Password Reset Token for ${email}: ${token}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Reset code sent to your email.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { success: false, error: "Something went wrong." },
      { status: 500 },
    );
  }
}
