import LoginForm from "@/components/Forms/LoginForm";
import { GridBackground } from "@/components/reusable-ui/grid-background";
import { authOptions } from "@/config/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import React from "react";
import { getAuthenticatedRedirectPath } from "@/lib/auth-redirect";

export default async function page() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const destination = await getAuthenticatedRedirectPath({
      userId: session.user.id,
      role: session.user.role,
      email: session.user.email,
      phone: session.user.phone,
      preferredPath: "/dashboard",
    });

    redirect(destination);
  }
  return <LoginForm />;
}
