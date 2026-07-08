import { authOptions } from "@/config/auth";
import { getServerSession } from "next-auth";

import { redirect } from "next/navigation";
import { ReactNode } from "react";
import NotAuthorized from "./NotAuthorized";
import { UserRole } from "@prisma/client";

// type Role = "USER" | "ADMIN";

interface Props {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default async function RoleBasedWrapper({
  children,
  allowedRoles,
}: Props) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user?.role as string)?.toUpperCase();
  const isAllowed = allowedRoles.some(role => role.toUpperCase() === userRole);
  
  console.log("RBA CHECK Detail:", {
    rawRole: session?.user?.role,
    userRole,
    typeOfUserRole: typeof userRole,
    allowedRoles,
    isAllowed
  });

  if (!session) {
    redirect("/auth");
  }

  if (!isAllowed) {
    console.warn("🚫 Not Authorized:", { userRole, allowedRoles });
    return <NotAuthorized />;
  }

  return <>{children}</>;
}
