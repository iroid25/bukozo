"use client";

import { useEffect, useRef, useState } from "react";

export interface UseAccountingSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  endpoint?: string;
}

export function useAccountingSyncVersion(
  options: UseAccountingSyncOptions = {},
) {
  const {
    enabled = true,
    intervalMs = 10000,
    endpoint = "/api/v1/accounting/sync-state",
  } = options;

  const [version, setVersion] = useState<string | null>(null);
  const currentVersionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchVersion = async () => {
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return;

        const payload = await response.json();
        const nextVersion =
          payload?.data?.version ??
          payload?.version ??
          payload?.data?.updatedAt ??
          payload?.updatedAt ??
          null;

        if (!nextVersion || cancelled) return;

        if (currentVersionRef.current === null) {
          currentVersionRef.current = nextVersion;
          return;
        }

        if (currentVersionRef.current !== nextVersion) {
          currentVersionRef.current = nextVersion;
          setVersion(nextVersion);
        }
      } catch {
        // Ignore sync polling errors and keep the previous version.
      }
    };

    void fetchVersion();
    const timer = window.setInterval(() => {
      void fetchVersion();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, endpoint, intervalMs]);

  return version;
}
