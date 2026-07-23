"use server";

import { db } from "@/prisma/db";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { EMAIL_FROM } from "@/lib/email";

export async function forgotPassword(email: string) {
  try {
    const user = await db.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Return success even if user not found to prevent enumeration
      return {
        success: true,
        message: "If an account exists, a reset code has been sent.",
      };
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
      const resend = new Resend(process.env.RESEND_API_KEY);

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
        // Still return success but log the error
        // In development, also return the token
        if (process.env.NODE_ENV === "development") {
          console.log(`[DEV] Password Reset Token for ${email}: ${token}`);
          return {
            success: true,
            message: "Reset code sent to your email.",
            token: token, // Only in development
          };
        }
      } else {
        console.log("Password reset email sent successfully:", data);
      }
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Fallback: Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV] Password Reset Token for ${email}: ${token}`);
        return {
          success: true,
          message: "Reset code generated (check console in dev mode).",
          token: token, // Only in development
        };
      }
    }

    return { success: true, message: "Reset code sent to your email." };
  } catch (error) {
    console.error("Forgot password error:", error);
    return { success: false, error: "Something went wrong." };
  }
}

export async function resetPassword(
  email: string,
  token: string,
  newPassword: string,
) {
  try {
    const user = await db.user.findFirst({
      where: {
        email,
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return { success: false, error: "Invalid or expired reset token." };
    }

    const hashedPassword = await hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordLastChanged: new Date(),
        requiresPasswordChange: false,
      },
    });

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    console.error("Reset password error:", error);
    return { success: false, error: "Failed to reset password." };
  }
}

export async function adminResetPassword(userId: string, newPassword: string) {
  // Check auth user role in the caller or here if needed, but usually this is used inside protected components
  // For strictness, let's add auth check
  const { getAuthUser } = await import("@/config/useAuth");
  const admin = await getAuthUser();

  if (!admin || (admin.role !== "ADMIN" && admin.role !== "BRANCHMANAGER")) {
    // Managers might reset teller passwords
    return { success: false, error: "Unauthorized" };
  }

  try {
    const hashedPassword = await hash(newPassword, 10);
    await db.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordLastChanged: new Date(),
        requiresPasswordChange: true, // Force them to change it next login
      },
    });
    return { success: true, message: "Password reset successfully." };
  } catch (error) {
    console.error("Admin reset password error:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
