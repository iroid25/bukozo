import { getServerSession, Session } from "next-auth";
import { authOptions } from "./auth";
import { UserRole } from "@prisma/client"; // ✅ ADD THIS IMPORT

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole; // ✅ CHANGED: from string to UserRole enum
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
