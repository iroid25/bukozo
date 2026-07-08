import type { Metadata } from "next";
import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import SendEmailClient from "./SendEmailClient";

export const metadata: Metadata = {
  title: "Send Email",
  description: "Send emails to members and users",
};

export default async function SendEmailPage() {
  const user = await getAuthUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    redirect("/dashboard");
  }

  return <SendEmailClient user={user} />;
}
