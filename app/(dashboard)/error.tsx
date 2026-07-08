"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { isChunkLoadError, reloadAfterChunkError } from "@/lib/chunk-recovery";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);

    if (isChunkLoadError(error)) {
      reloadAfterChunkError();
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">
          Something went wrong!
        </h2>
        <p className="mb-8 text-slate-500">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => reset()}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
