"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit3 } from "lucide-react";
import AccountTypeEditForm from "./components/AccountTypeEditForm";
import { Button } from "@/components/ui/button";

export default function AccountTypeEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accountType, setAccountType] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (role !== "ADMIN" && role !== "BRANCHMANAGER") { router.push("/dashboard"); return; }

    fetch(`/api/v1/account-types/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setAccountType(json.data || json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, session, status, router]);

  if (loading || status === "loading") {
    return <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-6 items-center justify-center text-slate-500">Loading...</div>;
  }

  if (!accountType) return null;

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-6">
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/account-types/${id}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Details
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Edit3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Edit Account Type</h1>
              <p className="text-sm text-muted-foreground">Modify {accountType.name} account type settings</p>
            </div>
          </div>
        </div>
      </div>

      <AccountTypeEditForm accountType={accountType} />
    </div>
  );
}
