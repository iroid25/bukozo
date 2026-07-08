// types/next-auth.d.ts
import { DefaultSession } from "next-auth";
import { Role, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      role: UserRole;
      branchId: string | null;
      branchName: string;
      branchLocation: string;
      requiresPasswordChange: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    branchId: string | null;
    branchName: string;
    branchLocation: string;
    requiresPasswordChange: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    role: UserRole;
    branchId: string | null;
    branchName: string;
    branchLocation: string;
    requiresPasswordChange: boolean;
  }
}
