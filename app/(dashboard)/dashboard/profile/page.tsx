import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import ProfileClient from "./components/ProfileClient";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your profile information",
};

export default async function ProfilePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  return <ProfileClient user={user} />;
}
