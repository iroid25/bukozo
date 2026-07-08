"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "./data-table";

export default function MemberAccountsPage() {
  const { id } = useParams<{ id: string }>();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/members/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setAccounts(json.data?.accounts || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Member Accounts</CardTitle></CardHeader>
        <CardContent><DataTable data={accounts} /></CardContent>
      </Card>
    </div>
  );
}
