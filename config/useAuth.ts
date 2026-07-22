import { getServerSession, Session } from "next-auth";
import { authOptions } from "./auth";
import { UserRole } from "@prisma/client";
import { db } from "@/prisma/db";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  image?: string;
  branchId: string;
  phone?: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session: Session | null = await getServerSession(authOptions);

  if (session?.user) {
    const { id, email, role, name, image, branchId, phone } = session.user as AuthUser;
    return { id, email, role, name, image, branchId, phone };
  }

  return null;
}

/**
 * Like getAuthUser() but re-fetches branchId from the database so stale
 * JWT tokens (e.g. after an admin transfers a user to another branch) don't
 * grant access to the old branch's data. Only the branchId is refreshed;
 * all other fields come from the session token for performance.
 */
export async function getAuthUserWithFreshBranch(): Promise<AuthUser | null> {
  const user = await getAuthUser();
  if (!user) return null;
  if (user.role === "ADMIN") return user;

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { branchId: true },
  });
  if (!dbUser) return null;

  return { ...user, branchId: dbUser.branchId || "" };
}
