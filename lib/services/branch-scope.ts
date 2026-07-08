import { UserRole } from "@prisma/client";

export type BranchScopedUser = {
  role: UserRole | string;
  branchId?: string | null;
};

export function resolveBranchScope(
  user: BranchScopedUser,
  requestedBranchId?: string | null,
) {
  if (user.role === UserRole.ADMIN) {
    return requestedBranchId || undefined;
  }

  return user.branchId || undefined;
}
