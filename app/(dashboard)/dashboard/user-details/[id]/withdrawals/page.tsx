"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WithdrawalsDataTable } from "./withdraws-data-table";

export default function MemberWithdrawalsPage() {
  const { id } = useParams<{ id: string }>();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/withdrawals?memberId=${id}`)
      .then((r) => r.json())
      .then((json) => {
        setWithdrawals(json.data || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Member Withdrawals</CardTitle></CardHeader>
        <CardContent><WithdrawalsDataTable data={withdrawals} /></CardContent>
      </Card>
    </div>
  );
}
