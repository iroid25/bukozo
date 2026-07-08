import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import FloatResetPageClient from "./FloatResetPageClient";

export default async function FloatResetPage() {
  const user = await getAuthUser();

  if (!["ACCOUNTANT", "ADMIN"].includes(user?.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <FloatResetPageClient />
    </div>
  );
}
