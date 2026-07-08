"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AssetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Assets page error:", error);
  }, [error]);

  const handleReload = () => {
    reset();
    router.refresh();
    window.location.reload();
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg border-rose-200 bg-rose-50/60 shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
            Assets page needs a refresh
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-center">
          <p className="text-sm text-slate-600">
            The assets route failed to load its current bundle. This usually
            happens after a rebuild or when the browser has an old cached chunk.
          </p>
          <div className="rounded-xl border border-rose-200 bg-white p-4 text-left text-xs text-slate-500">
            <div className="mb-2 font-semibold text-slate-700">Error</div>
            <div className="break-words">
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ""}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={reset} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button onClick={handleReload} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
