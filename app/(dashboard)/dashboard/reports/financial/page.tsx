import { redirect } from "next/navigation";

export default function FinancialReportsRedirectPage() {
  redirect("/dashboard/reports/financial-dashboard");
}
