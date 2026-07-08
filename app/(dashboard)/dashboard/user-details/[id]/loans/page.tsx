"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoansDataTable } from "./loans-data-table";

export default function MemberLoansPage() {
  const { id } = useParams<{ id: string }>();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/loans?memberId=${id}`)
      .then((r) => r.json())
      .then((json) => {
        setLoans(json.data || json.loans || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Member Loans</CardTitle></CardHeader>
        <CardContent><LoansDataTable data={loans} /></CardContent>
      </Card>
    </div>
  );
}
