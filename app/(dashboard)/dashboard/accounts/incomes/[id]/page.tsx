// app/dashboard/income/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { IncomeService } from "@/services/income.service";
import IncomeRecordDetail from "./IncomeRecordDetail";

interface IncomeDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function IncomeDetailPage({
  params,
}: IncomeDetailPageProps) {
  // Get user first to check authorization
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Await params
  const { id } = await params;

  // Fetch income record
  const branchFilter = await IncomeService.getBranchFilter(user as any);
  const incomeRecord = await IncomeService.getIncomeRecordById(id, branchFilter);

  // Handle errors or missing data
  if (!incomeRecord) {
    notFound();
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <IncomeRecordDetail
        incomeRecord={incomeRecord as any}
        userRole={user.role ?? "MEMBER"}
      />
    </div>
  );
}
