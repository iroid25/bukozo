import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import FingerprintDiagnosticClient from "./FingerprintDiagnosticClient";

export default async function FingerprintDiagnosticPage() {
  const user = await getAuthUser();

  if (!user?.id) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <FingerprintDiagnosticClient />;
}
