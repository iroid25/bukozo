// app/dashboard/expenditure/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { ExpenditureService } from "@/services/expenditure.service";
import ExpenditureRecordDetail from "../new/components/ExpenditureRecordDetail";

interface ExpenditureDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ExpenditureDetailPage({
  params,
}: ExpenditureDetailPageProps) {
  // Await params in Next.js 15
  const { id } = await params;

  const user = await getAuthUser();
  if (!user) redirect("/login");

  const branchFilter = await ExpenditureService.getBranchFilter(user as any);
  const expenditureRecord = await ExpenditureService.getExpenditureRecordById(id, branchFilter);

  // Handle missing data
  if (!expenditureRecord) {
    notFound();
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <ExpenditureRecordDetail
        expenditureRecord={expenditureRecord as any}
        userRole={user.role ?? "MEMBER"}
        userId={user.id ?? ""}
      />
    </div>
  );
}
