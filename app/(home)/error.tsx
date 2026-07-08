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
     <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong!</h2>
        <p className="text-gray-500 mb-6 max-w-sm">{error.message}</p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
    </div>
  );
}
