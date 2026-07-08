"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import StatementDetail from "../components/StatementDetail";
import { Statement, StatementData } from "@/types/statements";

interface StatementDetailPageClientProps {
  id: string;
}

export default function StatementDetailPageClient({
  id,
}: StatementDetailPageClientProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [statement, setStatement] = useState<Statement | null>(null);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [statementResponse, dataResponse] = await Promise.all([
          fetch(`/api/v1/statements/${id}`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`/api/v1/statements/${id}/data`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);

        const [statementResult, dataResult] = await Promise.all([
          statementResponse.json(),
          dataResponse.json(),
        ]);

        if (!statementResponse.ok || !statementResult.success) {
          throw new Error(statementResult.error || "Failed to load statement");
        }

        if (!dataResponse.ok || !dataResult.success) {
          throw new Error(
            dataResult.error || "Failed to load statement detail data",
          );
        }

        setStatement(statementResult.data);
        setStatementData(dataResult.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load statement",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Authentication required
          </h2>
          <p className="text-neutral-500">
            Please sign in to view statement details.
          </p>
        </div>
      </div>
    );
  }

  if (error || !statement || !statementData) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Unable to load statement
          </h2>
          <p className="max-w-md text-neutral-500">
            {error || "Statement data could not be loaded."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/statements")}
          >
            Back to Statements
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <StatementDetail
      statement={statement}
      statementData={statementData}
      userRole={session?.user?.role ?? "TELLER"}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}
