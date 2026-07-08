"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Utility ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(n);
const initials = (name: string) =>
  name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "??";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  id: string;
  memberNumber: string;
  user: { name: string; email: string | null; phone: string | null; image: string | null };
  accounts: {
    id: string;
    accountNumber: string;
    balance: number;
    shareValue?: number | null;
    accountType: { id?: string; name: string; isShareAccount?: boolean; sharePrice?: number | null };
  }[];
}

interface Institution {
  id: string;
  institutionNumber: string;
  institutionName: string;
  institutionType: string;
  institutionEmail: string;
  accounts: {
    id: string;
    accountNumber: string;
    balance: number;
    shareValue?: number | null;
    accountType: { id?: string; name: string; isShareAccount?: boolean; sharePrice?: number | null };
  }[];
}

interface Account {
  id: string;
  accountNumber: string;
  balance: number;
  shareValue?: number | null;
  accountType: { id?: string; name: string; isShareAccount?: boolean; sharePrice?: number | null };
}

interface ShareAccountType {
  id: string;
  name: string;
  sharePrice?: number | null;
  isShareAccount?: boolean;
}

type DepositActionMode = "DEPOSIT" | "SHARE_TRANSFER";
type ShareTargetMode = "EXISTING" | "NEW";

interface Props {
  open: boolean;
  onClose: () => void;
  userRole: string;
  userId: string;
}

const CHANNELS = [
  { value: "CASH", label: "Cash", icon: "💵" },
  { value: "CHEQUE", label: "Cheque", icon: "📝" },
  { value: "MOBILE_MONEY", label: "Mobile Money", icon: "📱" },
  { value: "BANK", label: "Bank", icon: "🏦" },
  { value: "TRANSFER", label: "Transfer", icon: "↔️" },
];

const FLOAT_GATED_ROLES = new Set(["TELLER", "AGENT"]);

// ── SearchSelect ──────────────────────────────────────────────────────────────
function SearchSelect({
  items,
  selected,
  onSelect,
  onDeselect,
  placeholder,
  getName,
  getSub,
  getBadge,
}: {
  items: any[];
  selected: any;
  onSelect: (item: any) => void;
  onDeselect: () => void;
  placeholder: string;
  getName: (item: any) => string;
  getSub: (item: any) => string;
  getBadge?: (item: any) => string;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter(
    (i) =>
      getName(i).toLowerCase().includes(q.toLowerCase()) ||
      getSub(i).toLowerCase().includes(q.toLowerCase())
  );

  if (selected) {
    return (
      <div className="flex items-center justify-between  rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-100 text-[10px] font-black text-green-800">
            {initials(getName(selected))}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{getName(selected)}</p>
            <p className="truncate text-[11px] text-gray-500">{getSub(selected)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="ml-3 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-8 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No results found</p>
        ) : (
          <div className="max-h-44 overflow-y-auto">
            {filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${
                  idx ? "border-t border-gray-100" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-black text-gray-600">
                    {initials(getName(item))}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{getName(item)}</p>
                    <p className="truncate text-[11px] text-gray-500">{getSub(item)}</p>
                  </div>
                </div>
                {getBadge && (
                  <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    {getBadge(item)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step badge ────────────────────────────────────────────────────────────────
function StepBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white transition-colors ${
        done ? "bg-green-500" : "bg-gray-900"
      }`}
    >
      {done ? "✓" : n}
    </div>
  );
}

// ── Deposit Dialog ────────────────────────────────────────────────────────────
function DepositDialog({ onClose, userRole, userId }: Props) {
  const router = useRouter();

  const [entityTab, setEntityTab] = useState<"MEMBER" | "INSTITUTION">("MEMBER");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<(typeof CHANNELS)[0] | null>(null);
  const [depositType, setDepositType] = useState("DIRECT");
  const [actionMode, setActionMode] = useState<DepositActionMode>("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [mmRef, setMmRef] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [description, setDescription] = useState("");
  const [feeType, setFeeType] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentYear, setStudentYear] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [parentMember, setParentMember] = useState<Member | null>(null);
  const [sourceAccount, setSourceAccount] = useState<Account | null>(null);
  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [transferSourceAccount, setTransferSourceAccount] = useState<Account | null>(null);
  const [selectedShareAccount, setSelectedShareAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [memberShareAccounts, setMemberShareAccounts] = useState<Account[]>([]);
  const [shareAccountTypes, setShareAccountTypes] = useState<ShareAccountType[]>([]);
  const [shareTargetMode, setShareTargetMode] = useState<ShareTargetMode>("EXISTING");
  const [selectedShareAccountTypeId, setSelectedShareAccountTypeId] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [floatStatus, setFloatStatus] = useState<any>(null);
  const [loadingFloat, setLoadingFloat] = useState(false);

  const floatRequired = FLOAT_GATED_ROLES.has((userRole || "").toUpperCase());

  const loadFloatStatus = async () => {
    if (!floatRequired) {
      setFloatStatus({ userFloat: null, currentUser: null });
      return;
    }

    setLoadingFloat(true);
    try {
      const res = await fetch("/api/v1/floats/me");
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to load float status");
      }
      setFloatStatus(data?.data ?? data);
    } catch (err) {
      console.error("Error loading float status:", err);
      toast.error("Failed to load float status");
      setFloatStatus({ userFloat: null, currentUser: null });
    } finally {
      setLoadingFloat(false);
    }
  };

  useEffect(() => {
    loadMembers();
    loadInstitutions();
    loadFloatStatus();
  }, []);

  useEffect(() => {
    if (actionMode === "SHARE_TRANSFER" && shareAccountTypes.length === 0) {
      void loadShareAccountTypes();
    }
  }, [actionMode, shareAccountTypes.length]);

  // Reset deposit type when switching away from INSTITUTION tab
  useEffect(() => {
    if (entityTab !== "INSTITUTION" && depositType === "FEE_PAYMENT") {
      setDepositType("DIRECT");
    }
  }, [entityTab]);

  useEffect(() => {
    if (actionMode !== "SHARE_TRANSFER") {
      setSelectedShareAccount(null);
      setMemberShareAccounts([]);
      setShareTargetMode("EXISTING");
      return;
    }
    if (!selectedMember) {
      setMemberShareAccounts([]);
      setShareTargetMode("NEW");
      return;
    }

    let cancelled = false;

    const loadShareAccounts = async () => {
      try {
        const res = await fetch(`/api/v1/members/${selectedMember.id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load member details");
        }

        const shareAccounts = Array.isArray(data?.data?.shareAccounts)
          ? data.data.shareAccounts
          : Array.isArray(data?.shareAccounts)
            ? data.shareAccounts
            : [];

        if (cancelled) return;
        setMemberShareAccounts(shareAccounts);
        setShareTargetMode(shareAccounts.length > 0 ? "EXISTING" : "NEW");
        // Auto-select when there is exactly one share account — no dep mutation needed
        if (shareAccounts.length === 1) {
          setSelectedShareAccount(shareAccounts[0]);
          setSelectedShareAccountTypeId(shareAccounts[0].accountType?.id || "");
        } else {
          setSelectedShareAccount(null);
        }
      } catch (error) {
        console.error("Failed to load share accounts", error);
        if (!cancelled) {
          setMemberShareAccounts([]);
          setSelectedShareAccount(null);
          setShareTargetMode("NEW");
        }
      }
    };

    void loadShareAccounts();

    return () => {
      cancelled = true;
    };
  // selectedShareAccountTypeId intentionally excluded: mutating it inside the effect
  // would re-trigger the fetch. Account-type selection is handled by the dropdown onChange.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionMode, selectedMember]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/v1/deposits/members");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load members");
      }
      const list = Array.isArray(data) ? data : data?.data;
      setMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error loading members:", err);
      toast.error("Failed to load members");
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const res = await fetch("/api/v1/deposits/institutions");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load institutions");
      }
      const list = Array.isArray(data) ? data : data?.data;
      setInstitutions(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Error loading institutions:", err);
      toast.error("Failed to load institutions");
      setInstitutions([]);
    } finally {
      setLoadingInstitutions(false);
    }
  };

  const loadShareAccountTypes = async () => {
    try {
      const res = await fetch("/api/v1/account-types");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load share account types");
      }

      const rows = Array.isArray(data?.data) ? data.data : [];
      const filtered = rows.filter(
        (item: any) => item.isShareAccount || item.ledgerAccount?.ledgerType === "EQUITY",
      );
      setShareAccountTypes(filtered);
      if (filtered.length === 1) {
        setSelectedShareAccountTypeId(filtered[0].id);
      }
    } catch (error) {
      console.error("Failed to load share account types", error);
      toast.error("Failed to load share account types");
      setShareAccountTypes([]);
    }
  };

  const step1Done = !!(selectedMember || selectedInstitution);
  const step2Done = !!selectedAccount;
  const newBalance = (selectedAccount?.balance ?? 0) + (Number(amount) || 0);
  const selectedShareAccounts = memberShareAccounts;
  const selectedShareAccountType = shareAccountTypes.find((type) => type.id === selectedShareAccountTypeId) || null;
  const hasExistingShareAccounts = selectedShareAccounts.length > 0;
  const shareValue = Number(selectedShareAccount?.shareValue ?? selectedShareAccountType?.sharePrice ?? 0);
  const sharePurchaseAmount = Number(amount) || 0;
  const derivedShares = shareValue > 0 ? sharePurchaseAmount / shareValue : 0;
  const hasSelectedShareTarget = shareTargetMode === "EXISTING" ? !!selectedShareAccount : !!selectedShareAccountTypeId;
  const isWholeShareAmount =
    actionMode !== "SHARE_TRANSFER" ||
    (shareValue > 0 && Math.abs(derivedShares - Math.round(derivedShares)) < 0.000001);
  
  // Check if member has sufficient balance for bank fee payment
  const memberTotalBalance = parentMember?.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0;
  const hasInsufficientBalance = selectedChannel?.value === "BANK" && depositType === "FEE_PAYMENT" && sourceAccount && Number(amount) > sourceAccount.balance;
  const requiredTopUp = hasInsufficientBalance ? Number(amount) - (sourceAccount?.balance || 0) : 0;
  
  // Require sourceAccount for bank fee payment
  const needsSourceAccount = selectedChannel?.value === "BANK" && depositType === "FEE_PAYMENT";
  const hasSourceAccountSelected = !needsSourceAccount || (needsSourceAccount && sourceAccount !== null);
  const floatBalance = Number(floatStatus?.userFloat?.balance ?? 0);
  const hasUsableFloat =
    selectedChannel?.value === "TRANSFER" ||
    !floatRequired ||
    (!loadingFloat &&
      !!floatStatus?.userFloat &&
      floatBalance > 0 &&
      floatStatus?.userFloat?.isActiveForDay !== false);

  const needsTransferSource = actionMode === "DEPOSIT" && selectedChannel?.value === "TRANSFER";
  const hasTransferSourceSelected = !needsTransferSource || !!transferSourceAccount;

  const canSubmit =
    actionMode === "SHARE_TRANSFER"
      ? !!selectedMember &&
        !!selectedAccount &&
        !!amount &&
        Number(amount) > 0 &&
        !selectedAccount.accountType?.isShareAccount &&
        hasSelectedShareTarget &&
        isWholeShareAmount
      : step1Done &&
        step2Done &&
        selectedChannel &&
        amount &&
        Number(amount) > 0 &&
        !hasInsufficientBalance &&
        hasSourceAccountSelected &&
        hasTransferSourceSelected &&
        hasUsableFloat;
  const entityAccounts = actionMode === "SHARE_TRANSFER"
    ? (selectedMember?.accounts ?? []).filter((acc: any) => !acc.accountType?.isShareAccount)
    : selectedMember?.accounts ?? selectedInstitution?.accounts ?? [];
  const entityName = selectedMember?.user?.name ?? selectedInstitution?.institutionName;

  const switchTab = (tab: "MEMBER" | "INSTITUTION") => {
    setEntityTab(tab);
    setSelectedMember(null);
    setSelectedInstitution(null);
    setSelectedAccount(null);
    setParentMember(null);
    setSourceAccount(null);
    setTransferMember(null);
    setTransferSourceAccount(null);
    setSelectedShareAccount(null);
    setSelectedShareAccountTypeId("");
    setMemberShareAccounts([]);
    setActionMode("DEPOSIT");
    setDepositType("DIRECT");
    setSelectedChannel(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (actionMode === "SHARE_TRANSFER") {
        const shareAmount = Number(amount);
        const resolvedShareValue = Number(
          selectedShareAccount?.shareValue ?? selectedShareAccountType?.sharePrice ?? 0,
        );

        if (!selectedAccount || !selectedMember) {
          throw new Error("Select both a source savings account and a target share account.");
        }

        if (!resolvedShareValue) {
          throw new Error("Selected share account does not have a valid share value.");
        }

        const numberOfShares = shareAmount / resolvedShareValue;
        if (!Number.isInteger(numberOfShares)) {
          throw new Error(
            `Amount must be a whole multiple of UGX ${fmt(resolvedShareValue)} for share transfers.`,
          );
        }

        const res = await fetch("/api/v1/shares/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shareAccountId: selectedShareAccount?.id || undefined,
              targetMemberId: selectedMember.id,
              shareAccountTypeId: shareTargetMode === "NEW" ? selectedShareAccountTypeId : undefined,
              sourceAccountId: selectedAccount.id,
              numberOfShares,
              notes: description || undefined,
          }),
        });
        const transferResult = await res.json();
        if (!res.ok) throw new Error(transferResult.error || "Failed to transfer savings to shares");
      } else if (selectedChannel?.value === "TRANSFER") {
        const res = await fetch("/api/v1/transfers/internal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceAccountId: transferSourceAccount!.id,
            targetAccountId: selectedAccount!.id,
            amount: Number(amount),
            description: description || undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to process transfer");
      } else {
        const res = await fetch("/api/v1/deposits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId: selectedMember?.id || (selectedChannel?.value === "BANK" && depositType === "FEE_PAYMENT" && sourceAccount ? null : parentMember?.id) || null,
            institutionId: selectedInstitution?.id || null,
            accountId: selectedAccount?.id,
            amount: Number(amount),
            channel: selectedChannel?.value,
            mobileMoneyRef: mmRef || undefined,
            depositorName: depositorName || undefined,
            description: description || undefined,
            depositType,
            feeType: feeType || undefined,
            studentName: studentName || undefined,
            studentClass: studentClass || undefined,
            studentYear: studentYear || undefined,
            institutionName: institutionName || undefined,
            sourceMemberId: selectedChannel?.value === "BANK" && depositType === "FEE_PAYMENT" && parentMember ? parentMember.id : undefined,
            sourceAccountId: selectedChannel?.value === "BANK" && depositType === "FEE_PAYMENT" && sourceAccount ? sourceAccount.id : undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to create deposit");
      }
      setSubmitted(true);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create deposit");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedMember(null); setSelectedInstitution(null); setSelectedAccount(null);
    setSelectedChannel(null); setDepositType("DIRECT"); setAmount(""); setMmRef("");
    setDepositorName(""); setDescription(""); setFeeType(""); setStudentName("");
    setStudentClass(""); setStudentYear(""); setInstitutionName(""); setParentMember(null); setSourceAccount(null);
    setTransferMember(null); setTransferSourceAccount(null); setSelectedShareAccount(null); setSelectedShareAccountTypeId(""); setMemberShareAccounts([]); setActionMode("DEPOSIT"); setSubmitted(false);
  };

  const handleClose = () => { handleReset(); onClose(); };

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col    items-center overflow-y-scroll h-[500px] justify-center px-8 py-14 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
        <h2 className="mb-1 text-lg font-extrabold text-gray-900">
          {actionMode === "SHARE_TRANSFER" || selectedChannel?.value === "TRANSFER"
            ? "Transfer completed!"
            : "Deposit created!"}
        </h2>
        <p className="text-sm text-gray-500">
          {actionMode === "SHARE_TRANSFER" || selectedChannel?.value === "TRANSFER"
            ? `${fmt(Number(amount))} transferred to`
            : `${fmt(Number(amount))} deposited to`}
        </p>
        <p className="mb-7 text-sm font-bold text-gray-900">
          {selectedAccount?.accountNumber} · {entityName}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            New deposit
          </button>
          <button
            onClick={handleClose}
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-base">
            📈
          </div>
          <div>
            <p className="text-sm font-bold text-white">New deposit</p>
            <p className="text-[11px] text-slate-400">Record a deposit transaction</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <button
            type="button"
            onClick={() => setActionMode("DEPOSIT")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              actionMode === "DEPOSIT"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Deposit
          </button>
          <button
            type="button"
          onClick={() => {
              setActionMode("SHARE_TRANSFER");
              setEntityTab("MEMBER");
              setSelectedInstitution(null);
              setSelectedChannel(null);
              setDepositType("DIRECT");
              void loadShareAccountTypes();
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              actionMode === "SHARE_TRANSFER"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Transfer to Shares
          </button>
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5">
          {[1, 2, 3].map((n, idx) => {
            const done = n === 1 ? step1Done : n === 2 ? step2Done : false;
            const active = n === (step2Done ? 3 : step1Done ? 2 : 1);
            return (
              <div key={n} className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black transition-all ${
                    done
                      ? "bg-emerald-400 text-slate-900"
                      : active
                      ? "bg-white text-slate-900"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {done ? "✓" : n}
                </div>
                {idx < 2 && (
                  <div className={`h-px w-4 transition-colors ${done ? "bg-emerald-400" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleClose}
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-xs text-slate-400 hover:bg-white/20 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* STEP 1 — Entity */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <StepBadge n={1} done={step1Done} />
              <span className={`text-xs font-bold ${step1Done ? "text-gray-400" : "text-gray-900"}`}>
                Select entity
              </span>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {(["MEMBER", "INSTITUTION"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => switchTab(tab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                    entityTab === tab
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <span>{tab === "MEMBER" ? "👤" : "🏢"}</span>
                  {tab === "MEMBER" ? "Members" : "Institutions"}
                </button>
              ))}
            </div>

            {entityTab === "MEMBER" ? (
              loadingMembers ? (
                <p className="py-5 text-center text-xs text-gray-400">Loading members…</p>
              ) : (
                <SearchSelect
                  items={members}
                  selected={selectedMember}
                  onSelect={(m) => { setSelectedMember(m); setSelectedAccount(null); setSelectedShareAccount(null); }}
                  onDeselect={() => { setSelectedMember(null); setSelectedAccount(null); setSelectedShareAccount(null); }}
                  placeholder="Search by name or member #…"
                  getName={(m) => m.user?.name || ""}
                  getSub={(m) => `#${m.memberNumber} · ${m.user?.email || ""}`}
                  getBadge={(m) => `${m.accounts?.length || 0} acct${m.accounts?.length !== 1 ? "s" : ""}`}
                />
              )
            ) : loadingInstitutions ? (
              <p className="py-5 text-center text-xs text-gray-400">Loading…</p>
            ) : institutions.length === 0 ? (
              <p className="py-5 text-center text-xs text-red-400">No institutions found ({institutions.length})</p>
            ) : (
              <SearchSelect
                items={institutions}
                selected={selectedInstitution}
                onSelect={(i) => { setSelectedInstitution(i); setSelectedAccount(null); setInstitutionName(i.institutionName || ""); }}
                onDeselect={() => { setSelectedInstitution(null); setSelectedAccount(null); setInstitutionName(""); }}
                placeholder="Search by name or institution #…"
                getName={(i) => i.institutionName}
                getSub={(i) => `#${i.institutionNumber} · ${i.institutionType}`}
              />
            )}
          </section>

          {/* STEP 2 — Account */}
          {step1Done && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <StepBadge n={2} done={step2Done} />
                <span className={`text-xs font-bold ${step2Done ? "text-gray-400" : "text-gray-900"}`}>
                  {actionMode === "SHARE_TRANSFER" ? "Select savings account" : "Select account"}
                </span>
              </div>

              {selectedAccount ? (
                <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm">💳</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{selectedAccount.accountNumber}</p>
                      <p className="text-[11px] text-gray-500">
                        {selectedAccount.accountType?.name} ·{" "}
                        <span className="font-semibold text-blue-700">{fmt(selectedAccount.balance)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAccount(null)}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {entityAccounts.map((acc: any) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccount(acc)}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-xs">💳</div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{acc.accountNumber}</p>
                          <p className="text-[11px] text-gray-500">{acc.accountType?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{fmt(acc.balance)}</p>
                        <p className="text-[10px] text-gray-400">current balance</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* STEP 3 — Details */}
          {step2Done && actionMode === "DEPOSIT" && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <StepBadge n={3} done={false} />
                <span className="text-xs font-bold text-gray-900">Deposit details</span>
              </div>

              {/* Amount + Channel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Amount (UGX) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                      UGX
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm font-bold text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Channel <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => {
                          setSelectedChannel(ch);
                          setTransferMember(null);
                          setTransferSourceAccount(null);
                        }}
                        className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-[9px] font-semibold transition-all ${
                          selectedChannel?.value === ch.value
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className="text-sm">{ch.icon}</span>
                        {ch.label.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* MM ref */}
              {selectedChannel?.value === "MOBILE_MONEY" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Mobile Money Reference
                  </label>
                  <input
                    value={mmRef}
                    onChange={(e) => setMmRef(e.target.value)}
                    placeholder="Transaction reference"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              )}

              {/* Transfer source selection */}
              {selectedChannel?.value === "TRANSFER" && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-purple-800">
                    Transfer from (source account)
                  </p>
                  <p className="mb-3 text-xs text-purple-600">
                    Select the member and account to deduct from. No float is affected.
                  </p>

                  {transferMember ? (
                    <div className="mb-2 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-[10px] font-black text-green-700">
                          {initials(transferMember.user?.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{transferMember.user?.name}</p>
                          <p className="text-[10px] text-gray-500">#{transferMember.memberNumber}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setTransferMember(null); setTransferSourceAccount(null); }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <SearchSelect
                      items={members.filter((m) => m.id !== selectedMember?.id)}
                      selected={transferMember}
                      onSelect={(m) => { setTransferMember(m); setTransferSourceAccount(null); }}
                      onDeselect={() => { setTransferMember(null); setTransferSourceAccount(null); }}
                      placeholder="Search source member…"
                      getName={(m) => m.user?.name || ""}
                      getSub={(m) => `#${m.memberNumber}`}
                      getBadge={(m) => `${m.accounts?.length || 0} acct`}
                    />
                  )}

                  {transferMember && transferMember.accounts && transferMember.accounts.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-purple-800">Source Account *</label>
                      <select
                        value={transferSourceAccount?.id || ""}
                        onChange={(e) => {
                          const acc = transferMember.accounts?.find((a: any) => a.id === e.target.value);
                          if (acc) setTransferSourceAccount(acc);
                        }}
                        className="w-full rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-purple-400"
                      >
                        <option value="">Select account…</option>
                        {transferMember.accounts.map((acc: any) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.accountNumber} — {acc.accountType?.name} (Balance: {fmt(acc.balance)})
                          </option>
                        ))}
                      </select>
                      {transferSourceAccount && Number(amount) > 0 && Number(amount) > transferSourceAccount.balance && (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          Insufficient balance — available {fmt(transferSourceAccount.balance)}, required {fmt(Number(amount))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Depositor name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Depositor name{" "}
                  <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="Person bringing the money"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Deposit type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Deposit type <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "DIRECT", label: "Direct deposit" },
                    ...(entityTab === "INSTITUTION" ? [{ value: "FEE_PAYMENT", label: "Fee payment" }] : []),
                  ].map((dt) => (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setDepositType(dt.value)}
                      className={`rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                        depositType === dt.value
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fee payment fields */}
              {depositType === "FEE_PAYMENT" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-wide text-amber-800">
                    Fee payment details
                  </p>
                  <p className="mb-3 text-xs text-amber-700">
                    School fees commission is deducted automatically from the deposited amount and posted to the correct commission accounts.
                  </p>
                  
                  {/* Show member selection for Bank channel (deduct from member) */}
                  {selectedChannel?.value === "BANK" && (
                    <div className="mb-3 flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-amber-800">Select Member (Deduct from) *</label>
                      {loadingMembers ? (
                        <p className="text-xs text-gray-400">Loading members...</p>
                      ) : members.length === 0 ? (
                        <p className="text-xs text-red-500">No members available</p>
                      ) : parentMember ? (
                        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-[10px] font-black text-green-700">
                              {initials(parentMember.user?.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{parentMember.user?.name}</p>
                              <p className="text-[10px] text-gray-500">#{parentMember.memberNumber}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-gray-500">Total Balance</p>
                            <p className="text-xs font-bold text-green-700">
                              {fmt(parentMember.accounts?.reduce((sum, acc) => sum + (acc.balance || 0), 0) || 0)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setParentMember(null); setSourceAccount(null); }}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <SearchSelect
                          items={members}
                          selected={parentMember}
                          onSelect={(m) => setParentMember(m)}
                          onDeselect={() => setParentMember(null)}
                          placeholder="Search member..."
                          getName={(m) => m.user?.name || ""}
                          getSub={(m) => `#${m.memberNumber}`}
                          getBadge={(m) => `${m.accounts?.length || 0} acct`}
                        />
                      )}
                      
                      {/* Show member's accounts for selection */}
                      {parentMember && parentMember.accounts && parentMember.accounts.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          <label className="text-[10px] font-semibold text-amber-800">Select Account to Deduct *</label>
                          <select
                            value={sourceAccount?.id || ""}
                            onChange={(e) => {
                              const acc = parentMember.accounts?.find((a: any) => a.id === e.target.value);
                              if (acc) setSourceAccount(acc);
                            }}
                            className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900"
                          >
                            <option value="">Select account...</option>
                            {parentMember.accounts.map((acc: any) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.accountNumber} - {acc.accountType?.name} (Balance: {fmt(acc.balance)})
                              </option>
                            ))}
                          </select>
                          {/* Balance warning with top-up recommendation */}
                          {sourceAccount && Number(amount) > 0 && Number(amount) > sourceAccount.balance && (
                            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] font-semibold text-red-700">Insufficient Balance</p>
                                  <p className="text-xs text-red-600">
                                    Available: {fmt(sourceAccount.balance)} | Required: {fmt(Number(amount))}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-red-700">Top-up Required</p>
                                  <p className="text-sm font-bold text-red-600">{fmt(Number(amount) - sourceAccount.balance)}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  // Store the pending fee payment details
                                  const pendingFeePayment = {
                                    channel: selectedChannel?.value,
                                    depositType: "FEE_PAYMENT",
                                    institutionName: institutionName,
                                    feeType,
                                    studentName,
                                    studentClass,
                                    studentYear,
                                    parentMember,
                                    sourceAccount,
                                  };
                                  // Calculate top-up amount needed
                                  const topUp = Number(amount) - sourceAccount.balance;
                                  // Set selected member to the parent member for the top-up
                                  setSelectedMember(parentMember);
                                  setSelectedAccount(null);
                                  // Switch back to members tab
                                  setEntityTab("MEMBER");
                                  setDepositType("DIRECT");
                                  // Pre-fill amount for top-up
                                  setAmount(String(topUp));
                                  toast.info(`Top-up of ${fmt(topUp)} needed. Select an account for deposit.`);
                                }}
                                className="mt-2 w-full rounded-lg bg-red-100 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-200"
                              >
                                💳 Proceed with Top-up → Member Account
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-semibold text-amber-800">
                        {selectedChannel?.value === "BANK" ? "Institution (Pay To) *" : "Select Institution / School *"}
                      </label>
                      {institutions.length === 0 ? (
                        <p className="text-xs text-red-500 py-2">No institutions available</p>
                      ) : (
                        <select
                          value={institutionName}
                          onChange={(e) => {
                            const inst = institutions.find(i => i.institutionName === e.target.value);
                            setInstitutionName(e.target.value);
                            if (inst) {
                              setSelectedInstitution(inst);
                              setSelectedAccount(null);
                            }
                          }}
                          className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-amber-400"
                        >
                          <option value="">Select school...</option>
                          {institutions.map((inst) => (
                            <option key={inst.id} value={inst.institutionName}>
                              {inst.institutionName} ({inst.institutionNumber})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-semibold text-amber-800">Parent/Guardian Paying (Optional)</label>
                      <input
                        value={depositorName}
                        onChange={(e) => setDepositorName(e.target.value)}
                        placeholder="Name of person paying"
                        className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                    {[
                      { label: "Fee type", value: feeType, setter: setFeeType, placeholder: "e.g. Tuition" },
                      { label: "Student name", value: studentName, setter: setStudentName, placeholder: "Full name" },
                      { label: "Class", value: studentClass, setter: setStudentClass, placeholder: "e.g. S.3" },
                      { label: "Academic year", value: studentYear, setter: setStudentYear, placeholder: "e.g. 2025/2026" },
                    ].map((f) => (
                      <div key={f.label} className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-amber-800">{f.label}</label>
                        <input
                          value={f.value}
                          onChange={(e) => f.setter(e.target.value)}
                          placeholder={f.placeholder}
                          className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Description{" "}
                  <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional notes about this deposit"
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Transaction summary */}
              {amount && Number(amount) > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Transaction summary
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {[
                      { label: "Entity", value: entityName },
                      { label: "Account", value: selectedAccount?.accountNumber },
                      { label: "Channel", value: selectedChannel?.label ?? "—" },
                      { label: "Current balance", value: fmt(selectedAccount?.balance ?? 0) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="text-gray-500">{row.label}</span>
                        <span className="font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-green-50 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-green-700">Deposit</span>
                      <span className="font-bold text-green-600">+ {fmt(Number(amount))}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
                    <span className="text-xs font-semibold text-slate-400">New balance</span>
                    <span className="text-sm font-black text-white">{fmt(newBalance)}</span>
                  </div>
                </div>
              )}

              {floatRequired && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    hasUsableFloat
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {loadingFloat
                    ? "Checking float availability..."
                    : hasUsableFloat
                    ? `Float ready: ${fmt(floatBalance)}`
                    : !floatStatus?.userFloat
                    ? "Float required to transact. Please add or allocate float first."
                    : floatBalance <= 0
                    ? "Your float balance is zero. Please replenish it before continuing."
                    : floatStatus?.userFloat?.isActiveForDay === false
                    ? "Your float session is not active today."
                    : "Float required to transact."}
                </div>
              )}
            </section>
          )}

          {step2Done && actionMode === "SHARE_TRANSFER" && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <StepBadge n={3} done={false} />
                <span className="text-xs font-bold text-gray-900">Transfer to shares</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Savings will be debited from the selected source account and posted into the member&apos;s share account.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Amount (UGX) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                      UGX
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className={`w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm font-bold text-gray-900 outline-none transition focus:ring-2 ${
                        actionMode === "SHARE_TRANSFER" && sharePurchaseAmount > 0 && shareValue > 0 && !isWholeShareAmount
                          ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                          : "border-gray-200 focus:border-emerald-400 focus:ring-emerald-100"
                      }`}
                    />
                  </div>
                  {actionMode === "SHARE_TRANSFER" && sharePurchaseAmount > 0 && shareValue > 0 && !isWholeShareAmount && (
                    <p className="mt-1 text-[11px] text-red-600">
                      Amount must be a multiple of {fmt(shareValue)} per share.{" "}
                      Enter{" "}
                      <button
                        type="button"
                        className="font-bold underline"
                        onClick={() => setAmount(String(Math.round(derivedShares) * shareValue))}
                      >
                        {fmt(Math.round(derivedShares) * shareValue)}
                      </button>{" "}
                      for {Math.round(derivedShares)} share{Math.round(derivedShares) !== 1 ? "s" : ""}.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Source savings account <span className="text-red-400">*</span>
                  </label>
                  {selectedAccount ? (
                    <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm">💳</div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{selectedAccount.accountNumber}</p>
                          <p className="text-[11px] text-gray-500">
                            {selectedAccount.accountType?.name} ·{" "}
                            <span className="font-semibold text-blue-700">{fmt(selectedAccount.balance)}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAccount(null)}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {entityAccounts.map((acc: any) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setSelectedAccount(acc)}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-xs">💳</div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{acc.accountNumber}</p>
                              <p className="text-[11px] text-gray-500">{acc.accountType?.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{fmt(acc.balance)}</p>
                            <p className="text-[10px] text-gray-400">current balance</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Selected target
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Member</span>
                    <span className="font-semibold text-gray-900">{entityName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Source savings account</span>
                    <span className="font-semibold text-gray-900">{selectedAccount?.accountNumber || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-white p-4">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Target share account <span className="text-red-400">*</span>
                  </label>
                  <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                    <button
                      type="button"
                      disabled={!hasExistingShareAccounts}
                      onClick={() => {
                        setShareTargetMode("EXISTING");
                        setSelectedShareAccountTypeId("");
                      }}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                        shareTargetMode === "EXISTING"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600"
                      } ${!hasExistingShareAccounts ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      Existing share account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShareTargetMode("NEW");
                        setSelectedShareAccount(null);
                      }}
                      className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                        shareTargetMode === "NEW"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      Open new share type
                    </button>
                  </div>

                  {shareTargetMode === "EXISTING" ? (
                    hasExistingShareAccounts ? (
                      <select
                        value={selectedShareAccount?.id || ""}
                        onChange={(e) => {
                          const account = selectedShareAccounts.find((item) => item.id === e.target.value);
                          setSelectedShareAccount(account || null);
                          setSelectedShareAccountTypeId(account?.accountType?.id || "");
                        }}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Select share account...</option>
                        {selectedShareAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.accountNumber} - {account.accountType?.name || "Share account"} ({fmt(Number(account.balance || 0))})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-500">
                        This member has no share account yet. Switch to "Open new share type" to create one.
                      </p>
                    )
                  ) : (
                    <>
                      {shareAccountTypes.length === 0 ? (
                        <p className="text-sm text-red-600">No share account types were found.</p>
                      ) : (
                        <select
                          value={selectedShareAccountTypeId}
                          onChange={(e) => {
                            const typeId = e.target.value;
                            setSelectedShareAccountTypeId(typeId);
                            setSelectedShareAccount(null);
                          }}
                          className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-400"
                        >
                          <option value="">Select share type to create...</option>
                          {shareAccountTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.name} {type.sharePrice ? `- UGX ${fmt(Number(type.sharePrice))}/share` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        A new share account will be created only for the selected share type.
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Amount to deduct</span>
                      <span className="font-semibold text-gray-900">{fmt(Number(amount || 0))}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Share value</span>
                      <span className="font-semibold text-gray-900">
                        {shareValue > 0 ? fmt(shareValue) : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Shares to buy</span>
                      <span className="font-semibold text-gray-900">
                        {shareValue > 0 ? Math.round(derivedShares).toString() : "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {(selectedShareAccount || selectedShareAccountTypeId) && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Share transfer summary
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {[
                      { label: "Member", value: entityName },
                      { label: "Source account", value: selectedAccount?.accountNumber },
                      {
                        label: "Target share account",
                        value: selectedShareAccount
                          ? selectedShareAccount.accountNumber
                          : selectedShareAccountType?.name || "Share account to create",
                      },
                      {
                        label: "Target mode",
                        value: shareTargetMode === "EXISTING" ? "Existing account" : "Create new account",
                      },
                      { label: "Share value", value: shareValue > 0 ? fmt(shareValue) : "—" },
                      { label: "Shares", value: shareValue > 0 ? Math.round(derivedShares).toString() : "0" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-xs">
                        <span className="text-gray-500">{row.label}</span>
                        <span className="font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between bg-emerald-50 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-emerald-700">Amount</span>
                      <span className="font-bold text-emerald-600">+ {fmt(Number(amount || 0))}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className={`rounded-xl border px-4 py-3 text-sm ${
                !isWholeShareAmount && sharePurchaseAmount > 0 && shareValue > 0
                  ? "border-red-200 bg-red-50 text-red-800"
                  : isWholeShareAmount
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}>
                {!isWholeShareAmount && sharePurchaseAmount > 0 && shareValue > 0
                  ? `Amount ${fmt(sharePurchaseAmount)} is not a whole multiple of ${fmt(shareValue)}. Correct the amount above to proceed.`
                  : shareTargetMode === "EXISTING"
                    ? selectedShareAccount
                      ? `This will deduct from ${selectedAccount?.accountNumber} and buy ${Math.round(derivedShares)} share(s) into ${selectedShareAccount.accountNumber}.`
                      : "Select the target share account to continue."
                    : selectedShareAccountType
                      ? `This will deduct from ${selectedAccount?.accountNumber} and create a new ${selectedShareAccountType.name} share account.`
                      : "Select a share type to continue."}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                canSubmit
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "cursor-not-allowed bg-slate-200 text-slate-400"
              }`}
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Processing…
                </>
              ) : (
                "Create deposit →"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DepositCreateForm({ open, onClose, userRole, userId }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-[580px]   flex-col overflow-y-scroll rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="max-h-[88vh] flex flex-col">
          <DepositDialog open={open} onClose={onClose} userRole={userRole} userId={userId} />
        </div>
      </div>
    </div>
  );
}
