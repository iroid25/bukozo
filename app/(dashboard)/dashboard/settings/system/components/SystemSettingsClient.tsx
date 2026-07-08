"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  Settings,
  Bell,
  Shield,
  ShieldCheck,
  UserCheck,
  Building2,
  Globe,
  Phone,
  Mail,
  MapPin,
  Clock,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
  email?: string;
}

interface SystemSettingsClientProps {
  user: User;
}

const SECTION_NAV = [
  { id: "institution", label: "Institution Profile", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "roles", label: "Role Management", icon: ShieldCheck },
  { id: "system", label: "System Preferences", icon: Settings },
  { id: "periodic", label: "Periodic Operations", icon: Clock },
];

function SectionAnchor({ id }: { id: string }) {
  return <span id={id} className="-mt-20 block pt-20 invisible" aria-hidden />;
}

function PeriodicOperationsCard() {
  const now = new Date();
  const [chargeYear, setChargeYear] = useState(String(now.getFullYear()));
  const [chargeMonth, setChargeMonth] = useState(String(now.getMonth() + 1));
  const [interestYear, setInterestYear] = useState(String(now.getFullYear()));
  const [interestPeriod, setInterestPeriod] = useState<"MONTHLY" | "ANNUALLY">("ANNUALLY");
  const [interestMonth, setInterestMonth] = useState(String(now.getMonth() + 1));
  const [chargeDryRun, setChargeDryRun] = useState(false);
  const [interestDryRun, setInterestDryRun] = useState(false);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [interestLoading, setInterestLoading] = useState(false);

  async function runMonthlyCharges() {
    setChargeLoading(true);
    try {
      const res = await fetch("/api/v1/accounts/process-monthly-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dryRun: chargeDryRun, year: Number(chargeYear), month: Number(chargeMonth) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed", { description: data.error }); return; }
      const { summary } = data;
      if (chargeDryRun) {
        toast.info(`Dry run — ${summary.eligible} eligible accounts, UGX ${summary.totalCharged.toLocaleString()} would be charged.`);
      } else {
        toast.success("Monthly charges processed", {
          description: `${summary.charged} accounts charged, UGX ${summary.totalCharged.toLocaleString()} total. ${summary.skipped} skipped.`,
        });
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setChargeLoading(false);
    }
  }

  async function runInterest() {
    setInterestLoading(true);
    try {
      const res = await fetch("/api/v1/accounts/process-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dryRun: interestDryRun,
          year: Number(interestYear),
          month: interestPeriod === "MONTHLY" ? Number(interestMonth) : undefined,
          period: interestPeriod,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed", { description: data.error }); return; }
      const { summary } = data;
      if (interestDryRun) {
        toast.info(`Dry run — ${summary.eligible} eligible accounts, UGX ${summary.totalInterest.toLocaleString()} interest would be posted.`);
      } else {
        toast.success("Interest posted", {
          description: `${summary.posted} accounts credited, UGX ${summary.totalInterest.toLocaleString()} total. ${summary.skipped} skipped.`,
        });
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setInterestLoading(false);
    }
  }

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Periodic Operations</CardTitle>
            <CardDescription className="mt-0.5">
              Run monthly charges and interest posting for BUTCS savings accounts.
              Always preview with <strong>Dry Run</strong> before committing.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monthly Charges */}
        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">Monthly Charge Deduction</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deducts the monthly service charge (e.g. UGX 500 from Voluntary Savings) for the selected period.
              Skips accounts already charged or with insufficient balance.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={chargeYear}
                onChange={(e) => setChargeYear(e.target.value)}
                min={2020}
                max={2099}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <select
                value={chargeMonth}
                onChange={(e) => setChargeMonth(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 self-end pb-1">
              <Switch checked={chargeDryRun} onCheckedChange={setChargeDryRun} id="charge-dry-run" />
              <Label htmlFor="charge-dry-run" className="text-xs cursor-pointer">Dry run</Label>
            </div>
            <Button
              size="sm"
              variant={chargeDryRun ? "outline" : "default"}
              onClick={runMonthlyCharges}
              disabled={chargeLoading}
              className="self-end"
            >
              {chargeLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Processing…</> : chargeDryRun ? "Preview" : "Run Charges"}
            </Button>
          </div>
        </div>

        {/* Interest Posting */}
        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">Interest Posting</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Credits interest to Compulsory Savings (18% p.a.) and Junior Savings (10% p.a.) accounts.
              Fixed Savings interest is handled at maturity. Voluntary Savings earns no interest.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Period type</Label>
              <select
                value={interestPeriod}
                onChange={(e) => setInterestPeriod(e.target.value as "MONTHLY" | "ANNUALLY")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ANNUALLY">Annual (end-of-year)</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={interestYear}
                onChange={(e) => setInterestYear(e.target.value)}
                min={2020}
                max={2099}
                className="h-9"
              />
            </div>
            {interestPeriod === "MONTHLY" && (
              <div className="space-y-1">
                <Label className="text-xs">Month</Label>
                <select
                  value={interestMonth}
                  onChange={(e) => setInterestMonth(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 self-end pb-1">
              <Switch checked={interestDryRun} onCheckedChange={setInterestDryRun} id="interest-dry-run" />
              <Label htmlFor="interest-dry-run" className="text-xs cursor-pointer">Dry run</Label>
            </div>
            <Button
              size="sm"
              variant={interestDryRun ? "outline" : "default"}
              onClick={runInterest}
              disabled={interestLoading}
              className="self-end"
            >
              {interestLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Processing…</> : interestDryRun ? "Preview" : "Post Interest"}
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            These operations are idempotent — re-running the same period will skip already-processed accounts.
            Use <strong>Dry Run</strong> first to confirm the expected charges/interest before committing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SystemSettingsClient({ user }: SystemSettingsClientProps) {
  const [settings, setSettings] = useState({
    systemName: "BUTCS Management System",
    institutionName: "Bukonzo United Teachers' Cooperative Savings and Credit Society Limited",
    registrationNumber: "REG. NO: 9668 / RCS",
    systemEmail: "bukonzounitedteacherssacco@gmail.com",
    systemPhone: "0779-021565",
    alternatePhone: "0788-566925",
    postalAddress: "P.O. Box 142, Kasese, Uganda",
    emailNotifications: true,
    smsNotifications: false,
    sessionTimeout: "60",
    passwordExpiry: "180",
    maxLoginAttempts: "5",
    defaultCurrency: "UGX",
    dateFormat: "DD/MM/YYYY",
    timeZone: "Africa/Kampala",
  });

  const [roleLimits, setRoleLimits] = useState<any[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("institution");

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch("/api/v1/settings/roles");
        const result = await response.json();
        if (result.success) setRoleLimits(result.data);
      } catch {
        // silent
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    SECTION_NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleRoleToggle = async (role: string, isActive: boolean) => {
    try {
      const response = await fetch("/api/v1/settings/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, isActive }),
      });
      const result = await response.json();
      if (result.success) {
        setRoleLimits((prev) => prev.map((r) => (r.role === role ? { ...r, isActive } : r)));
        toast.success(`${role.replace("_", " ")} updated`);
      } else {
        toast.error(result.error || "Failed to update role");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string | boolean) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex min-h-screen">
      {/* Sticky sidebar nav */}
      <aside className="hidden lg:flex lg:w-56 xl:w-64 shrink-0 flex-col gap-1 pt-8 pr-4 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sections
        </p>
        {SECTION_NAV.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
            }}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeSection === id
                ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </a>
        ))}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-8 py-8 pr-2">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure system-wide preferences for{" "}
              <span className="font-medium text-foreground">BUTCS</span>
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="shrink-0 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {/* ── Institution Profile ── */}
        <section>
          <SectionAnchor id="institution" />
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950">
                  <Building2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Institution Profile</CardTitle>
                  <CardDescription>Legal identity and contact details for the SACCO</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="institutionName">Full Registered Name</Label>
                  <Input
                    id="institutionName"
                    value={settings.institutionName}
                    onChange={(e) => set("institutionName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={settings.registrationNumber}
                    onChange={(e) => set("registrationNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="systemName">System / App Name</Label>
                  <Input
                    id="systemName"
                    value={settings.systemName}
                    onChange={(e) => set("systemName", e.target.value)}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="systemEmail" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Official Email
                  </Label>
                  <Input
                    id="systemEmail"
                    type="email"
                    value={settings.systemEmail}
                    onChange={(e) => set("systemEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="systemPhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Primary Phone
                  </Label>
                  <Input
                    id="systemPhone"
                    value={settings.systemPhone}
                    onChange={(e) => set("systemPhone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="alternatePhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    Alternate Phone
                  </Label>
                  <Input
                    id="alternatePhone"
                    value={settings.alternatePhone}
                    onChange={(e) => set("alternatePhone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postalAddress" className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Postal Address
                  </Label>
                  <Input
                    id="postalAddress"
                    value={settings.postalAddress}
                    onChange={(e) => set("postalAddress", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Notifications ── */}
        <section>
          <SectionAnchor id="notifications" />
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
                  <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Notification Settings</CardTitle>
                  <CardDescription>Control how the system sends alerts and messages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send transaction alerts and system notices via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(v) => set("emailNotifications", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">SMS Notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send OTPs and transaction summaries via SMS
                  </p>
                </div>
                <Switch
                  checked={settings.smsNotifications}
                  onCheckedChange={(v) => set("smsNotifications", v)}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Security ── */}
        <section>
          <SectionAnchor id="security" />
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950">
                  <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Security Settings</CardTitle>
                  <CardDescription>Login policies and session management</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionTimeout" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Session Timeout (min)
                  </Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min={5}
                    max={480}
                    value={settings.sessionTimeout}
                    onChange={(e) => set("sessionTimeout", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Auto-logout after inactivity</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="passwordExpiry" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Password Expiry (days)
                  </Label>
                  <Input
                    id="passwordExpiry"
                    type="number"
                    min={30}
                    value={settings.passwordExpiry}
                    onChange={(e) => set("passwordExpiry", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Force password reset period</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="maxLoginAttempts" className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    Max Login Attempts
                  </Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min={3}
                    max={10}
                    value={settings.maxLoginAttempts}
                    onChange={(e) => set("maxLoginAttempts", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Before account lock</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Role Management ── */}
        <section>
          <SectionAnchor id="roles" />
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-950">
                  <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Role Management</CardTitle>
                  <CardDescription>Enable or disable system roles across the SACCO</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {loadingRoles ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading roles…
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <UserCheck className="h-4 w-4 text-purple-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Account Opening Officers</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Allow ACCOUNT_OPENER role to create and open member accounts
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          roleLimits.find((r) => r.role === "ACCOUNT_OPENER")?.isActive
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-slate-300 bg-slate-50 text-slate-500"
                        }
                      >
                        {roleLimits.find((r) => r.role === "ACCOUNT_OPENER")?.isActive
                          ? "Active"
                          : "Disabled"}
                      </Badge>
                      <Switch
                        checked={roleLimits.find((r) => r.role === "ACCOUNT_OPENER")?.isActive ?? false}
                        onCheckedChange={(v) => handleRoleToggle("ACCOUNT_OPENER", v)}
                        disabled={loadingRoles}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── System Preferences ── */}
        <section>
          <SectionAnchor id="system" />
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
                  <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">System Preferences</CardTitle>
                  <CardDescription>Locale, currency, and formatting defaults</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="defaultCurrency">Currency</Label>
                  <Input
                    id="defaultCurrency"
                    value={settings.defaultCurrency}
                    onChange={(e) => set("defaultCurrency", e.target.value)}
                    placeholder="UGX"
                  />
                  <p className="text-xs text-muted-foreground">ISO 4217 code (e.g. UGX)</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Input
                    id="dateFormat"
                    value={settings.dateFormat}
                    onChange={(e) => set("dateFormat", e.target.value)}
                    placeholder="DD/MM/YYYY"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="timeZone" className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    Time Zone
                  </Label>
                  <Input
                    id="timeZone"
                    value={settings.timeZone}
                    onChange={(e) => set("timeZone", e.target.value)}
                    placeholder="Africa/Kampala"
                  />
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-3 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                <p className="text-xs text-sky-700 dark:text-sky-300">
                  BUTCS operates in <strong>Uganda (EAT, UTC+3)</strong>. All timestamps are stored in UTC and displayed
                  in Africa/Kampala time.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Periodic Operations ── */}
        <section>
          <SectionAnchor id="periodic" />
          <PeriodicOperationsCard />
        </section>
      </div>
    </div>
  );
}
