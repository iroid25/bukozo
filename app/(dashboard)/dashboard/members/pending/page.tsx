import { getAuthUser } from "@/config/useAuth";
import { redirect } from "next/navigation";
import PendingMembersTable from "./components/PendingMembersTable";
import { serverFetch } from "@/lib/server-fetch";

export default async function PendingMembersPage() {
  const user = await getAuthUser();

  if (!user || (user.role !== "ADMIN" && user.role !== "BRANCHMANAGER")) {
    return redirect("/dashboard");
  }

  const res = await serverFetch("/api/v1/members/pending");
  const json = res.ok ? await res.json() : { data: [] };
  const pendingMembers = json.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Member Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve new member registrations.
          </p>
        </div>
      </div>

      <PendingMembersTable members={pendingMembers as any} />
    </div>
  );
}
