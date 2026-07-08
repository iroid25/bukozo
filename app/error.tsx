"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { isChunkLoadError, reloadAfterChunkError } from "@/lib/chunk-recovery";

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong!</h2>
        <p className="text-gray-500 mb-8">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={() => reset()}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors focus:ring-4 focus:ring-blue-100 outline-none"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
