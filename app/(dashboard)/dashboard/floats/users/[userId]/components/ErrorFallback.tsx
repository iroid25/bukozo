// app/dashboard/float/users/[userId]/components/ErrorFallback.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface ErrorFallbackProps {
  title: string;
  message: string;
  showBackButton?: boolean;
  showRetryButton?: boolean;
}

export default function ErrorFallback({
  title,
  message,
  showBackButton = false,
  showRetryButton = false,
}: ErrorFallbackProps) {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-gray-600">{message}</p>
        <div className="mt-4 flex gap-2 justify-center">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={handleGoBack}
              className="inline-flex items-center"
            >
              Go Back
            </Button>
          )}
          {showRetryButton && (
            <Button onClick={handleRetry} className="inline-flex items-center">
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
