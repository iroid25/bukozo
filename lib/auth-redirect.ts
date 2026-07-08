import { UserRole } from "@prisma/client";
import { resolveAuthenticatedUser } from "@/lib/auth-user";

function normalizePreferredPath(path?: string | null) {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path === "/login") return null;
  return path;
}

export async function getAuthenticatedRedirectPath(params: {
  userId: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
  preferredPath?: string | null;
}) {
  const preferredPath = normalizePreferredPath(params.preferredPath);

  if (params.role !== "MEMBER") {
    return preferredPath || "/dashboard";
  }

  const user = await resolveAuthenticatedUser({
    id: params.userId,
    email: params.email,
    phone: params.phone,
  });

  const hasEmail = !!user?.email?.trim();
  const hasNIN = !!user?.member?.nin?.trim();
  const isApproved = user?.member?.isApproved ?? false;

  if (!hasEmail || !hasNIN) {
    return "/complete-profile";
  }

  if (!isApproved) {
    return "/pending-approval";
  }

  return preferredPath || "/dashboard";
}
