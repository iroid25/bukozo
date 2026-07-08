import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import SendSMSClient from "./SendSMSClient";

export const metadata: Metadata = {
  title: "Send SMS",
  description: "Send SMS messages to members and users",
};

export default async function SendSMSPage() {
  const user = await getAuthUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    redirect("/dashboard");
  }

  return <SendSMSClient user={user} />;
}
