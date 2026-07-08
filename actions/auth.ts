"use server";

import { db } from "@/prisma/db";
import { getAuthUser } from "@/config/useAuth";
import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function changePassword(formData: FormData) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return { error: "Unauthorized" };
    }

    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: "All fields are required" };
    }

    if (newPassword !== confirmPassword) {
      return { error: "New passwords do not match" };
    }

    if (newPassword.length < 6) {
      return { error: "New password must be at least 6 characters" };
    }

    // Fetch user with password to verify
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || !dbUser.password) {
      return { error: "User not found" };
    }

    const isMatch = await compare(currentPassword, dbUser.password);
    if (!isMatch) {
      return { error: "Incorrect current password" };
    }

    // Hash new password
    const hashedPassword = await hash(newPassword, 12);

    // Update user
    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        requiresPasswordChange: false,
        passwordLastChanged: new Date(),
      },
    });

    return { success: "Password changed successfully" };
  } catch (error) {
    console.error("Change password error:", error);
    return { error: "Something went wrong" };
  }
}
