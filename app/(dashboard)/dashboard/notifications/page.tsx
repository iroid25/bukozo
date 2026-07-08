// @ts-nocheck
import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Manage system notifications and alerts",
};

export default async function NotificationsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <NotificationsClient user={user} />;
}
