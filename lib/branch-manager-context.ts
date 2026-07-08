import { db } from "@/prisma/db";
import { UserRole } from "@prisma/client";

type SessionUserLike = {
  id?: string | null;
  email?: string | null;
  branchId?: string | null;
};

type BranchManagerContext = {
  user: {
    id: string;
    role: UserRole;
    branchId: string | null;
  } | null;
  branchId: string | null;
};

export async function resolveBranchManagerContext(
  sessionUser: SessionUserLike,
  allowAdminFallback = true
): Promise<BranchManagerContext> {
  const user = sessionUser.id
    ? await db.user.findUnique({
        where: { id: sessionUser.id },
        select: {
          id: true,
          role: true,
          branchId: true,
        },
      })
    : null;

  const fallbackUser =
    user ||
    (sessionUser.email
      ? await db.user.findFirst({
          where: {
            email: { equals: sessionUser.email, mode: "insensitive" },
          },
          select: {
            id: true,
            role: true,
            branchId: true,
          },
        })
      : null);

  const sessionBranchId = sessionUser.branchId ?? null;
  const branchId = fallbackUser?.branchId ?? sessionBranchId ?? null;

  if (branchId) {
    return {
      user: fallbackUser,
      branchId,
    };
  }

  if (allowAdminFallback && fallbackUser?.role === UserRole.ADMIN) {
    const fallbackBranch = await db.branch.findFirst({
      select: {
        id: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      user: fallbackUser,
      branchId: fallbackBranch?.id ?? null,
    };
  }

  return {
    user: fallbackUser,
    branchId: null,
  };
}
