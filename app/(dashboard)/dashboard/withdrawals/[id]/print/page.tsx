"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import WithdrawalPrintView from "../../components/WithdrawalPrintView";

export default function WithdrawalPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [withdrawal, setWithdrawal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/withdrawals/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setWithdrawal(json.data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  if (!withdrawal) return <div className="min-h-screen bg-white flex items-center justify-center">Withdrawal not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      <WithdrawalPrintView withdrawal={withdrawal} />
    </div>
  );
}
