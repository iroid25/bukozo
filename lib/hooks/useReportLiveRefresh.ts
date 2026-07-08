"use client";

import { useEffect, useState } from "react";
import { useAccountingSyncVersion, type UseAccountingSyncOptions } from "./useAccountingSync";

export interface UseReportLiveRefreshOptions extends UseAccountingSyncOptions {
  enabled?: boolean;
  intervalMs?: number;
  syncPollIntervalMs?: number;
}

export function useReportLiveRefresh(options: UseReportLiveRefreshOptions = {}) {
  const {
    enabled = true,
    intervalMs = 15000,
    syncPollIntervalMs = 10000,
    endpoint,
  } = options;

  const syncVersion = useAccountingSyncVersion({
    enabled,
    intervalMs: syncPollIntervalMs,
    endpoint,
  });
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      setRefreshVersion((current) => current + 1);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!syncVersion) return;
    setRefreshVersion((current) => current + 1);
  }, [syncVersion]);

  return refreshVersion;
}
