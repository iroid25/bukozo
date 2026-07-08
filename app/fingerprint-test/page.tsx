import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import FingerprintDiagnosticClient from "@/app/(dashboard)/dashboard/developer/fingerprint-diagnostic/FingerprintDiagnosticClient";

export default async function FingerprintTestPage() {
  const user = await getAuthUser();

  if (!user?.id) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <FingerprintDiagnosticClient />;
}
