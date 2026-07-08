"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionsDataTable } from "./transactions-data-table";

export default function MemberTransactionsPage() {
  const { id } = useParams<{ id: string }>();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/transactions?memberId=${id}`)
      .then((r) => r.json())
      .then((json) => {
        setTransactions(json.data || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Member Transactions</CardTitle></CardHeader>
        <CardContent><TransactionsDataTable data={transactions} /></CardContent>
      </Card>
    </div>
  );
}
