"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import FeesSettingsPage from "./fees-client";
import {
  MOBILE_MONEY_TRANSFER_FEES,
  AGENT_WITHDRAWAL_FEES,
  AGENT_DEPOSIT_FEES,
  SCHOOL_FEES_COMMISSION,
  DEFAULT_PENALTY_TIERS,
  SAVINGS_POLICIES,
} from "@/config/fees";

const KEYS = [
  "MOBILE_MONEY_FEES",
  "AGENT_WITHDRAWAL_FEES",
  "AGENT_DEPOSIT_FEES",
  "SCHOOL_FEES_COMMISSION",
  "PENALTY_CONFIG",
  "SAVINGS_CONFIG",
];

const DEFAULTS: Record<string, any> = {
  MOBILE_MONEY_FEES: MOBILE_MONEY_TRANSFER_FEES,
  AGENT_WITHDRAWAL_FEES: AGENT_WITHDRAWAL_FEES,
  AGENT_DEPOSIT_FEES: AGENT_DEPOSIT_FEES,
  SCHOOL_FEES_COMMISSION: SCHOOL_FEES_COMMISSION,
  PENALTY_CONFIG: DEFAULT_PENALTY_TIERS,
  SAVINGS_CONFIG: SAVINGS_POLICIES,
};

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) { router.push("/login"); return; }

    Promise.all(KEYS.map((key) =>
      fetch(`/api/v1/settings/fees?key=${key}`).then((r) => r.json())
    )).then((results) => {
      const [mmRes, awRes, adRes, sfRes, pRes, sRes] = results;
      setInitialData({
        mobileMoney: mmRes.data || DEFAULTS.MOBILE_MONEY_FEES,
        agentWithdrawal: awRes.data || DEFAULTS.AGENT_WITHDRAWAL_FEES,
        agentDeposit: adRes.data || DEFAULTS.AGENT_DEPOSIT_FEES,
        schoolFees: sfRes.data || DEFAULTS.SCHOOL_FEES_COMMISSION,
        penalty: pRes.data || DEFAULTS.PENALTY_CONFIG,
        savings: sRes.data || DEFAULTS.SAVINGS_CONFIG,
        userId: (session.user as any).id,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [session, status, router]);

  if (loading || status === "loading") {
    return <div className="p-6 text-slate-500">Loading fee settings...</div>;
  }

  if (!initialData) return null;

  return <FeesSettingsPage initialData={initialData as any} />;
}
