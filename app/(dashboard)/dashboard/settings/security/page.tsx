import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import SecuritySettingsClient from "./components/SecuritySettingsClient";

export const metadata: Metadata = {
  title: "Security Settings",
  description: "Manage your account security and privacy settings",
};

export default async function SecuritySettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <SecuritySettingsClient user={user} />;
}
