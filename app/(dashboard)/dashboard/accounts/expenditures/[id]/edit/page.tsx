import { notFound, redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { ExpenditureService } from "@/services/expenditure.service";
import ExpenditureRecordForm from "../../new/ExpenditureRecordForm";
import { serverFetch } from "@/lib/server-fetch";

interface ExpenditureEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExpenditureEditPage({
  params,
}: ExpenditureEditPageProps) {
  const { id } = await params;

  const user = await getAuthUser();
  if (!user) redirect("/login");

  const branchFilter = await ExpenditureService.getBranchFilter(user as any);

  const [expenditureRecord, categoriesRes, branchesRes] = await Promise.all([
    ExpenditureService.getExpenditureRecordById(id, branchFilter),
    serverFetch("/api/v1/budget-categories?kind=EXPENSE"),
    serverFetch("/api/v1/branches"),
  ]);

  if (!expenditureRecord) {
    notFound();
  }

  const categoriesJson = categoriesRes.ok ? await categoriesRes.json() : { data: [] };
  const branchesJson = branchesRes.ok ? await branchesRes.json() : { data: [] };

  const categories = categoriesJson.data ?? [];
  const branches = branchesJson.data ?? [];

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Expenditure Record</h1>
      </div>

      <ExpenditureRecordForm
        isOpen={true}
        onClose={() => {}}
        categories={categories as any}
        branches={branches as any}
        userId={user?.id ?? ""}
        userRole={user?.role as any}
        userBranchId={user?.branchId ?? undefined}
        isEditMode={true}
        editData={expenditureRecord as any}
      />
    </div>
  );
}
