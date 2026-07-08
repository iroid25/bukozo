"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

type ResultState = {
  ok: boolean;
  data?: any;
  error?: string;
  message?: string;
};

type MemberProfile = {
  member: {
    id: string;
    memberNumber: string;
    name: string;
    phone: string | null;
    membershipStatus: string;
  };
  totalBalance: number;
  accountCount: number;
  activeLoansCount: number;
  totalLoanOutstanding: number;
};

async function postJson(url: string, body: Record<string, any>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false || payload.error) {
    throw new Error(payload.error || payload.message || "Request failed");
  }

  return payload;
}

export default function MobileMoneyTestingPage() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [amount, setAmount] = useState("5000");
  const [loanId, setLoanId] = useState("");
  const [description, setDescription] = useState("SACCO Deposit");
  const [internalReference, setInternalReference] = useState("");

  const [depositResult, setDepositResult] = useState<ResultState | null>(null);
  const [withdrawalResult, setWithdrawalResult] = useState<ResultState | null>(null);
  const [repaymentResult, setRepaymentResult] = useState<ResultState | null>(null);
  const [statusResult, setStatusResult] = useState<ResultState | null>(null);
  const [busy, setBusy] = useState<"deposit" | "withdrawal" | "repayment" | "status" | null>(null);

  const numericAmount = useMemo(() => Number(amount), [amount]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        const response = await fetch("/api/v1/members/me", {
          credentials: "include",
        });
        const payload = await response.json();

        if (!response.ok || payload.success === false) {
          throw new Error(payload.error || payload.message || "Failed to load member profile");
        }

        if (mounted) {
          setProfile(payload.data as MemberProfile);
          setPhoneNumber((payload.data as MemberProfile)?.member?.phone || "");
          setGlobalError(null);
        }
      } catch (error: any) {
        if (mounted) {
          setGlobalError(error?.message || "Unable to load profile");
        }
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  const inputClass =
    "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 outline-none ring-0 transition focus:border-cyan-400/40 focus:bg-white/8";
  const panelClass =
    "rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl";

  const runAction = async (
    kind: "deposit" | "withdrawal" | "repayment" | "status",
  ) => {
    try {
      setBusy(kind);
      setGlobalError(null);

      if (kind === "deposit") {
        const payload = await postJson("/api/v1/members/me/mobile-money/deposit", {
          phoneNumber,
          amount: numericAmount,
          description: description || "SACCO Deposit",
        });
        setDepositResult({ ok: true, data: payload.data, message: payload.message });
        toast.success("Deposit request sent");
      }

      if (kind === "withdrawal") {
        const payload = await postJson("/api/v1/members/me/mobile-money/withdrawal", {
          phoneNumber,
          amount: numericAmount,
          description: description || "SACCO Withdrawal",
        });
        setWithdrawalResult({ ok: true, data: payload.data, message: payload.message });
        toast.success("Withdrawal request sent");
      }

      if (kind === "repayment") {
        const payload = await postJson("/api/v1/members/me/mobile-money/loan-repayment", {
          phoneNumber,
          loanId,
          amount: numericAmount,
          description: description || (loanId ? `Loan Repayment #${loanId}` : "Loan Repayment"),
        });
        setRepaymentResult({ ok: true, data: payload.data, message: payload.message });
        toast.success("Loan repayment request sent");
      }

      if (kind === "status") {
        const payload = await postJson("/api/v1/relworx/verify", {
          internalReference,
        });
        setStatusResult({ ok: true, data: payload.data || payload, message: payload.message });
        toast.success("Status check completed");
      }
    } catch (error: any) {
      const result = {
        ok: false,
        error: error?.message || "Request failed",
      };

      if (kind === "deposit") setDepositResult(result);
      if (kind === "withdrawal") setWithdrawalResult(result);
      if (kind === "repayment") setRepaymentResult(result);
      if (kind === "status") setStatusResult(result);

      toast.error(result.error || "Request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_30%),linear-gradient(180deg,#07111f_0%,#050816_45%,#030712_100%)] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <header className="mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Relworx test console
              </p>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Mobile Money testing page
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Use this page to trigger Relworx deposits, withdrawals, loan repayments, and status checks from the live app.
                It works best when you are signed in as a member.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
              <div className="font-semibold text-slate-100">Quick note</div>
              <div className="mt-2 max-w-sm">
                Deposits and repayments initiate a pull from the member. Withdrawals push funds to the member.
              </div>
            </div>
          </div>
        </header>

        {globalError ? (
          <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {globalError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className={panelClass}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Member context</h2>
                <p className="text-sm text-slate-400">
                  Loaded from <code>/api/v1/members/me</code>
                </p>
              </div>
              <Link
                href="/dashboard/accounts"
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10"
              >
                Open accounts
              </Link>
            </div>

            {profileLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                Loading profile...
              </div>
            ) : profile ? (
              <div className="grid gap-4 md:grid-cols-4">
                <InfoTile label="Member" value={profile.member.name} />
                <InfoTile label="Member No." value={profile.member.memberNumber} />
                <InfoTile label="Phone" value={profile.member.phone || "No phone"} />
                <InfoTile label="Status" value={profile.member.membershipStatus} />
                <InfoTile label="Accounts" value={String(profile.accountCount)} />
                <InfoTile label="Loans" value={String(profile.activeLoansCount)} />
                <InfoTile label="Balance" value={`UGX ${profile.totalBalance.toLocaleString()}`} />
                <InfoTile label="Outstanding" value={`UGX ${profile.totalLoanOutstanding.toLocaleString()}`} />
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                Could not load member profile. Sign in as a member to run initiation tests.
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Phone number
                </label>
                <input
                  className={inputClass}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+2567XXXXXXXX"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Amount (UGX)
                </label>
                <input
                  className={inputClass}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5000"
                  type="number"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Loan ID
                </label>
                <input
                  className={inputClass}
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                  placeholder="Optional for repayment"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Description
                </label>
                <input
                  className={inputClass}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="SACCO Deposit"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Internal reference for status check
              </label>
              <input
                className={inputClass}
                value={internalReference}
                onChange={(e) => setInternalReference(e.target.value)}
                placeholder="Relworx internal_reference"
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <ActionCard
                title="Test deposit"
                description="Pull money from the member into savings."
                buttonLabel={busy === "deposit" ? "Sending..." : "Send deposit"}
                onClick={() => runAction("deposit")}
                disabled={busy !== null}
                accent="cyan"
              />
              <ActionCard
                title="Test withdrawal"
                description="Push money from savings back to the member."
                buttonLabel={busy === "withdrawal" ? "Sending..." : "Send withdrawal"}
                onClick={() => runAction("withdrawal")}
                disabled={busy !== null}
                accent="emerald"
              />
              <ActionCard
                title="Test repayment"
                description="Pull money and attach it to a loan repayment."
                buttonLabel={busy === "repayment" ? "Sending..." : "Send repayment"}
                onClick={() => runAction("repayment")}
                disabled={busy !== null}
                accent="violet"
              />
              <ActionCard
                title="Check status"
                description="Verify Relworx with an internal reference."
                buttonLabel={busy === "status" ? "Checking..." : "Check status"}
                onClick={() => runAction("status")}
                disabled={busy !== null}
                accent="amber"
              />
            </div>
          </section>

          <aside className="grid gap-6">
            <ResultPanel title="Deposit response" result={depositResult} />
            <ResultPanel title="Withdrawal response" result={withdrawalResult} />
            <ResultPanel title="Repayment response" result={repaymentResult} />
            <ResultPanel title="Status response" result={statusResult} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function ActionCard({
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
  accent,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  disabled: boolean;
  accent: "cyan" | "emerald" | "violet" | "amber";
}) {
  const accentMap = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-400/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-400/20",
    violet: "from-violet-500/20 to-violet-500/5 border-violet-400/20",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-400/20",
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-4 ${accentMap[accent]}`}>
      <h3 className="text-base font-semibold text-slate-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function ResultPanel({
  title,
  result,
}: {
  title: string;
  result: ResultState | null;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">
{JSON.stringify(result, null, 2)}
        </pre>
      </div>
    </div>
  );
}
