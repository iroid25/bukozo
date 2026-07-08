"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DepositsDataTable } from "./deposits-data-table";

export default function MemberDepositsPage() {
  const { id } = useParams<{ id: string }>();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/deposits?memberId=${id}`)
      .then((r) => r.json())
      .then((json) => {
        setDeposits(json.data || []);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Member Deposits</CardTitle></CardHeader>
        <CardContent><DepositsDataTable data={deposits} /></CardContent>
      </Card>
    </div>
  );
}
