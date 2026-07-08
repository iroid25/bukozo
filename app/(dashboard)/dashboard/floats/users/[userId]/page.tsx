import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import FloatDetailPageClient from "./FloatDetailPageClient";

interface FloatDetailPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function FloatDetailPage({
  params,
}: FloatDetailPageProps) {
  const user = await getAuthUser();

  if (!user?.id) {
    redirect("/login");
  }

  const allowedRoles = ["ADMIN", "BRANCHMANAGER", "TELLER", "AGENT"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const { userId } = await params;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <FloatDetailPageClient userId={userId} />
    </div>
  );
}
