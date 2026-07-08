"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import WithdrawalFeesManager from "./withdrawal-fees-manager";

export default function FeesSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accountTypes, setAccountTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }
    const role = (session.user as any).role;
    if (!["ADMIN", "ACCOUNTANT"].includes(role)) { router.push("/dashboard"); return; }

    fetch("/api/v1/account-types/fees")
      .then((r) => r.json())
      .then((json) => {
        setAccountTypes(json.data || json || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status, router]);

  if (loading || status === "loading") {
    return <div className="container mx-auto p-6 text-slate-500">Loading fees settings...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Charges & Fees Settings</h1>
        <p className="text-muted-foreground">
          Configure withdrawal fee tiers, flat fees, and monthly charges per account type.
        </p>
      </div>
      <WithdrawalFeesManager initialAccountTypes={accountTypes} />
    </div>
  );
}
