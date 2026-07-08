import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import ChangePasswordClient from "./components/ChangePasswordClient";

export const metadata: Metadata = {
  title: "Change Password",
  description: "Update your account password",
};

export default async function ChangePasswordPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <ChangePasswordClient user={user} />;
}
