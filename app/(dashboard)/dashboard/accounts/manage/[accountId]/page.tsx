import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/config/useAuth";
import { serverFetch } from "@/lib/server-fetch";
import { TableLoading } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Settings, AlertTriangle } from "lucide-react";

interface PageProps {
  params: Promise<{ accountId: string }>;
}

async function ManageAccountContent({ accountId }: { accountId: string }) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const res = await serverFetch(`/api/v1/accounts/${accountId}`);
  if (!res.ok) notFound();

  const json = await res.json();
  const account = json.data ?? json;

  const isAdmin = user.role === "ADMIN";
  const isBranchManager = user.role === "BRANCHMANAGER";
  const canManage = isAdmin || isBranchManager;

  if (!canManage) redirect("/dashboard/accounts");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href={`/dashboard/accounts/${accountId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Account Details
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Account Management</h1>
              <p className="text-muted-foreground">
                Manage account {account.accountNumber}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={account.status === "ACTIVE" ? "default" : "secondary"}>
          {account.status}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Account Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Account Number</p>
              <p className="font-semibold">{account.accountNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Type</p>
              <p className="font-semibold">{account.accountType?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="font-semibold text-green-600">UGX {Number(account.balance ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch</p>
              <p className="font-semibold">{account.branch?.name ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Admin Actions
            </CardTitle>
            <CardDescription>Irreversible account actions — admin only</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <form action={`/api/v1/accounts/${accountId}/close`} method="POST">
                <Button
                  type="submit"
                  variant="destructive"
                  className="w-full"
                  disabled={account.status === "CLOSED"}
                >
                  {account.status === "CLOSED" ? "Account Already Closed" : "Close Account"}
                </Button>
              </form>
              <p className="text-xs text-destructive">Warning: This action cannot be undone.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function ManageAccountPage({ params }: PageProps) {
  const { accountId } = await params;
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Suspense fallback={<TableLoading />}>
        <ManageAccountContent accountId={accountId} />
      </Suspense>
    </div>
  );
}
