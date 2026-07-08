"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DepositPrintView from "@/app/(dashboard)/dashboard/deposits/components/DepositPrintView";

export default function DepositPrintPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sizeParam = searchParams.get("size");
  const size = sizeParam === "58mm" ? "58mm" : "80mm";

  const [deposit, setDeposit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/deposits/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((json) => {
        setDeposit(json.data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 14,
          letterSpacing: 2,
          color: "#444",
        }}
      >
        LOADING RECEIPT...
      </div>
    );
  }

  if (error || !deposit) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontSize: 13,
          color: "#444",
        }}
      >
        DEPOSIT NOT FOUND
      </div>
    );
  }

  return <DepositPrintView deposit={deposit} size={size} />;
}
