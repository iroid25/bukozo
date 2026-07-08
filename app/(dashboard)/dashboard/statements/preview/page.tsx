"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import StatementDetail from "../components/StatementDetail";
import { Button } from "@/components/ui/button";

export default function StatementPreviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/v1/statements/preview?${searchParams.toString()}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load statement preview");
        }

        setPayload(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load statement preview",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [searchParams, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            Unable to load statement preview
          </h2>
          <p className="max-w-md text-neutral-500">
            {error || "Preview data could not be loaded."}
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
      statement={payload.statement}
      statementData={payload.data}
      userRole={session?.user?.role ?? "TELLER"}
      currentUserId={session?.user?.id ?? ""}
    />
  );
}
