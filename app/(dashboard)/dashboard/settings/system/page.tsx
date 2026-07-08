import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import SystemSettingsClient from "./components/SystemSettingsClient";

export const metadata: Metadata = {
  title: "System Settings",
  description: "Manage system configuration and preferences",
};

export default async function SystemSettingsPage() {
  const user = await getAuthUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    redirect("/dashboard");
  }

  return <SystemSettingsClient user={user} />;
}
