// actions/auth/verify-role.ts
"use server";

import { getAuthUser } from "@/config/useAuth";

type VerifyRoleResponse = {
  success: boolean;
  userId?: string;
  userRole?: string;
  userName?: string;
  canCreateCategories?: boolean;
  error?: string;
};

/**
 * Verify user's role server-side
 * This is safer than passing role only through props
 */
export async function verifyUserRole(): Promise<VerifyRoleResponse> {
  try {
    const user = await getAuthUser();

    if (!user) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    const canCreateCategories =
      user.role === "ADMIN" || user.role === "ACCOUNTANT";

    console.log("✓ User verified:", {
      userId: user.id,
      role: user.role,
      canCreate: canCreateCategories,
    });

    return {
      success: true,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      canCreateCategories,
    };
  } catch (error) {
    console.error("Error verifying user role:", error);
    return {
      success: false,
      error: "Failed to verify user role",
    };
  }
}
