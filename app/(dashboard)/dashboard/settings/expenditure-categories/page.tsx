import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import ExpenditureCategoriesClient from "./ExpenditureCategoriesClient";

export default async function ExpenditureCategoriesPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    return redirect("/dashboard");
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Expenditure Categories</h2>
          <p className="text-muted-foreground">
            Manage categories for expense tracking and reporting.
          </p>
        </div>
      </div>
      <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
        <ExpenditureCategoriesClient />
      </div>
    </div>
  );
}
