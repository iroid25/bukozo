"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { TableLoading } from "@/components/ui/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AccountTypeDetailsView from "../components/AccountTypeDetailsView";
import type { AccountType } from "@/types/accountTypes";

export default function AccountTypeDetailsPage() {
  const { data: session, status } = useSession();
  const params = useParams<{ id: string }>();
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !params?.id) return;

    let cancelled = false;

    const loadAccountType = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/v1/account-types/${params.id}`, {
          credentials: "include",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch account type");
        }

        if (!cancelled) {
          setAccountType(data.data);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to fetch account type",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAccountType();

    return () => {
      cancelled = true;
    };
  }, [params?.id, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <TableLoading />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <Alert>
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please sign in to view account type details.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error || !accountType) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
        <Alert variant="destructive">
          <AlertTitle>Failed to load account type</AlertTitle>
          <AlertDescription>{error || "Account type not found."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
      <AccountTypeDetailsView
        accountType={accountType}
        userRole={(session?.user as any)?.role ?? "ADMIN"}
      />
    </div>
  );
}
