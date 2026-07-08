"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import TransactionDetails from "../components/TransactionDetail";
import TransactionDetailsSkeleton from "../components/Loading";

export default function TransactionDetailsPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!transactionId) return;
    fetch(`/api/v1/transactions/${transactionId}/details`)
      .then((r) => r.json())
      .then((json) => {
        setData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [transactionId]);

  if (loading) return <div className="min-h-screen bg-gray-50"><TransactionDetailsSkeleton /></div>;
  if (!data) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Transaction not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <TransactionDetails
        transaction={data.transaction}
        relatedData={data.relatedData}
        auditLog={data.auditLog}
        accountHistory={data.accountHistory}
      />
    </div>
  );
}
