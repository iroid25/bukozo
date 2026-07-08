"use client";

import { useEffect } from "react";

const STAFF_ROLES = new Set([
  "ADMIN", "BRANCHMANAGER", "ACCOUNTANT", "TELLER", "AGENT", "LOANOFFICER", "AUDITOR",
]);

export default function MonthlyChargeAutoRunner({ role }: { role: string }) {
  useEffect(() => {
    if (!STAFF_ROLES.has(role)) return;

    // Use a month-scoped key so the check fires once per month per browser session
    const now = new Date();
    const sessionKey = `mca_${now.getFullYear()}_${now.getMonth() + 1}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    // Fire and forget — completely silent, never blocks the UI
    fetch("/api/v1/system/auto-monthly-charges", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [role]);

  return null;
}
