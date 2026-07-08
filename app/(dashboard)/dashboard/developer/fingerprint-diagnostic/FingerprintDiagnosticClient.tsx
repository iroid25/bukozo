"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FingerprintCapture } from "@/lib/fingerprint";

type MemberSearchResult = {
  id: string;
  memberNumber: string;
  name: string;
  phone: string;
  branch: string;
};

type MemberDebugInfo = {
  memberId: string;
  memberNumber: string;
  memberName: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  hasTemplate: boolean;
  templateLength: number;
  templatePreview: string;
  isISOFormat: boolean;
  templateFormat: string | null;
  fingerprintQuality: number | null;
  fingerprintEnrolledAt: string | null;
  fingerprintUpdatedAt: string | null;
  storedTemplate: string | null;
};

type MatchResultItem = {
  label: string;
  format: "ISO" | "ANSI";
  template1: string;
  template2: string;
  ErrorCode?: number;
  ErrorDescription?: string;
  MatchingScore?: number;
  ok: boolean;
};

export default function FingerprintDiagnosticClient() {
  const [memberId, setMemberId] = useState("");
  const [memberInfo, setMemberInfo] = useState<MemberDebugInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [capture, setCapture] = useState<FingerprintCapture | null>(null);
  const [results, setResults] = useState<MatchResultItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loadingMember, setLoadingMember] = useState(false);
  const [loadingCapture, setLoadingCapture] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawDebug, setRawDebug] = useState<Record<string, unknown> | null>(null);
  const [rawTemplate, setRawTemplate] = useState<Record<string, unknown> | null>(null);

  const addLog = (message: string) => {
    console.log(`[fingerprint-diag] ${message}`);
    setLogs((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev]);
  };

  const loadMemberById = async (selectedMemberId: string) => {
    if (!selectedMemberId.trim()) {
      toast.error("Select a member first.");
      return;
    }

    setLoadingMember(true);
    setResults([]);
    setRawDebug(null);
    setRawTemplate(null);

    try {
      console.log("[fingerprint-diag] STEP 1: loading debug info for", selectedMemberId);
      addLog(`STEP 1 → POST /api/fingerprint/debug memberId=${selectedMemberId}`);

      const debugResponse = await fetch("/api/fingerprint/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMemberId.trim() }),
      });
      const debugResult = await debugResponse.json();

      console.log("[fingerprint-diag] STEP 1 debug response", {
        status: debugResponse.status,
        ok: debugResponse.ok,
        body: debugResult,
      });
      setRawDebug({ status: debugResponse.status, body: debugResult });
      addLog(
        `STEP 1 ← status=${debugResponse.status} success=${debugResult.success} hasTemplate=${debugResult.data?.hasTemplate} templateLen=${debugResult.data?.templateLength}`,
      );

      if (!debugResponse.ok || !debugResult.success) {
        throw new Error(debugResult.error || "Failed to load member fingerprint info");
      }

      // Show member card immediately, even before template loads
      setMemberInfo({
        ...debugResult.data,
        storedTemplate: debugResult.data.storedTemplate ?? null,
      });

      const debugStoredTemplate = debugResult.data.storedTemplate ?? null;
      if (debugStoredTemplate) {
        addLog(
          `STEP 1b → using debug payload template len=${debugStoredTemplate.length} instead of secondary lookup`,
        );
        setMemberInfo((prev) => ({
          ...prev!,
          storedTemplate: debugStoredTemplate,
        }));
      }

      console.log("[fingerprint-diag] STEP 2: loading fingerprint template for", selectedMemberId);
      addLog(`STEP 2 → GET /api/members/${selectedMemberId}/fingerprint-template`);

      const templateResponse = await fetch(
        `/api/members/${encodeURIComponent(selectedMemberId.trim())}/fingerprint-template`,
      );
      const templateResult = await templateResponse.json();

      console.log("[fingerprint-diag] STEP 2 template response", {
        status: templateResponse.status,
        ok: templateResponse.ok,
        hasTemplate: !!templateResult.template,
        templateLength: templateResult.template?.length ?? 0,
        templatePreview: templateResult.template?.slice(0, 24) ?? "(none)",
        error: templateResult.error ?? null,
      });
      setRawTemplate({
        status: templateResponse.status,
        hasTemplate: !!templateResult.template,
        templateLength: templateResult.template?.length ?? 0,
        templatePreview: templateResult.template?.slice(0, 24) ?? "(none)",
        error: templateResult.error ?? null,
      });
      addLog(
        `STEP 2 ← status=${templateResponse.status} hasTemplate=${!!templateResult.template} len=${templateResult.template?.length ?? 0} err=${templateResult.error ?? "none"}`,
      );
      const templateFromApi =
        templateResponse.ok && !templateResult.error
          ? templateResult.template || null
          : null;

      if (!templateResponse.ok || templateResult.error) {
        addLog(`WARN: template endpoint did not return a template -> ${templateResult.error ?? "no template"}`);
        if (!debugStoredTemplate) {
          toast.warning(
            templateResult.error ||
              "Member has no fingerprint enrolled. Capture a fingerprint, then click Enroll.",
          );
        }
      }

      const resolvedTemplate = templateFromApi || debugStoredTemplate;
      if (!resolvedTemplate) {
        addLog("WARN: no template available from debug or template endpoint");
        toast.warning("Template field in response is empty - member may need re-enrollment.");
        return;
      }

      setMemberInfo((prev) => ({
        ...prev!,
        memberName: templateResult.name ?? prev?.memberName ?? null,
        email: templateResult.email ?? prev?.email ?? null,
        storedTemplate: resolvedTemplate,
        fingerprintQuality:
          templateResult.fingerprintQuality ?? prev?.fingerprintQuality ?? null,
        fingerprintEnrolledAt:
          templateResult.fingerprintEnrolledAt ?? prev?.fingerprintEnrolledAt ?? null,
      }));

      addLog(
        `OK: member=${debugResult.data.memberNumber} templateLen=${resolvedTemplate.length} ISO=${debugResult.data.isISOFormat}`,
      );
      toast.success("Member fingerprint loaded successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load fingerprint debug info";
      console.error("[fingerprint-diag] loadMemberById error", error);
      toast.error(message);
      addLog(`ERROR: ${message}`);
    } finally {
      setLoadingMember(false);
    }
  };

  const loadMember = async () => {
    await loadMemberById(memberId);
  };

  const searchMembers = async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter a member number, name, or phone first.");
      return;
    }

    setSearchLoading(true);
    try {
      console.log("[fingerprint-diag] searching members", searchQuery);
      const response = await fetch(
        `/api/v1/members/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      const result = await response.json();
      console.log("[fingerprint-diag] search response", {
        status: response.status,
        ok: response.ok,
        count: result.data?.length,
      });

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to search members");
      }

      setSearchResults(result.data || []);
      addLog(`Search "${searchQuery}" → ${result.data?.length ?? 0} result(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Member search failed";
      toast.error(message);
      addLog(`ERROR search: ${message}`);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const captureLive = async () => {
    setLoadingCapture(true);
    try {
      console.log("[fingerprint-diag] requesting capture");

      // Path A: browser → localhost:8001/capture (bridge — has CORS, calls SgiBioSrv internally)
      let data: FingerprintCapture | null = null;
      try {
        addLog("CAPTURE → localhost:8001/capture (bridge)");
        const bridgeRes = await fetch("http://localhost:8001/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20000),
        });
        const bridgeData = await bridgeRes.json() as FingerprintCapture & { error?: string };
        console.log("[fingerprint-diag] bridge capture", {
          ErrorCode: bridgeData.ErrorCode,
          ImageQuality: bridgeData.ImageQuality,
          hasNative: !!bridgeData.NativeTemplateBase64,
          bridgeError: bridgeData.bridgeError ?? null,
        });
        if (bridgeData.ErrorCode === 0) {
          addLog(`CAPTURE bridge OK quality=${bridgeData.ImageQuality}/100 native=${bridgeData.NativeTemplateBase64 ? "✓" : "-"}`);
          data = bridgeData;
        } else {
          addLog(`CAPTURE bridge FAIL code=${bridgeData.ErrorCode} err=${bridgeData.error ?? "none"}`);
        }
      } catch (bridgeErr) {
        addLog(`CAPTURE bridge ERROR: ${bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr)} — trying server proxy`);
      }

      // Path B: server proxy fallback (same-machine setup)
      if (!data) {
        addLog("CAPTURE → POST /api/fingerprint/capture (server proxy)");
        const response = await fetch("/api/fingerprint/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const proxyData = await response.json() as FingerprintCapture & { error?: string };
        addLog(`CAPTURE proxy ← status=${response.status} code=${proxyData.ErrorCode ?? "n/a"}`);
        if (!response.ok || proxyData.ErrorCode !== 0) {
          throw new Error(proxyData.error || `Capture failed with code ${proxyData.ErrorCode ?? "unknown"}`);
        }
        data = proxyData;
      }

      console.log("[fingerprint-diag] final capture data", {
        ErrorCode: data.ErrorCode,
        ImageQuality: data.ImageQuality,
        hasISO: !!data.ISOTemplateBase64,
        hasANSI: !!data.TemplateBase64,
        hasNative: !!data.NativeTemplateBase64,
        nativeLen: (data.NativeTemplateBase64?.length ?? 0),
        bridgeError: data.bridgeError ?? null,
      });

      setCapture(data);
      addLog(
        `CAPTURE OK quality=${data.ImageQuality}/100 native=${data.NativeTemplateBase64 ? "✓" : "-"} bridgeErr=${data.bridgeError ?? "none"}`,
      );
      toast.success(`Fingerprint captured (quality ${data.ImageQuality}/100)${data.bridgeError ? " — bridge error: " + data.bridgeError : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fingerprint capture failed";
      console.error("[fingerprint-diag] capture error", error);
      toast.error(message);
      addLog(`ERROR capture: ${message}`);
    } finally {
      setLoadingCapture(false);
    }
  };

  const enrollFromCapture = async () => {
    if (!memberId.trim()) {
      toast.error("Select a member first.");
      return;
    }
    if (!capture) {
      toast.error("Capture a fingerprint first.");
      return;
    }

    const template = capture.TemplateBase64 || capture.ISOTemplateBase64;
    if (!template) {
      toast.error("Captured fingerprint has no template data.");
      return;
    }

    setEnrolling(true);
    try {
      addLog(`ENROLL → POST /api/members/enroll-fingerprint memberId=${memberId}`);
      console.log("[fingerprint-diag] enrolling fingerprint", {
        memberId,
        quality: capture.ImageQuality,
        templateLen: template.length,
      });

      const response = await fetch("/api/members/enroll-fingerprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: memberId.trim(),
          templateBase64: template,
          quality: capture.ImageQuality,
        }),
      });
      const data = await response.json();

      console.log("[fingerprint-diag] enroll response", {
        status: response.status,
        ok: response.ok,
        body: data,
      });
      addLog(
        `ENROLL ← status=${response.status} success=${data.success} err=${data.error ?? "none"}`,
      );

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Enrollment failed");
      }

      toast.success("Fingerprint enrolled! Reloading template...");
      await loadMemberById(memberId.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Enrollment failed";
      console.error("[fingerprint-diag] enroll error", error);
      toast.error(message);
      addLog(`ERROR enroll: ${message}`);
    } finally {
      setEnrolling(false);
    }
  };

  const clearTemplate = async () => {
    if (!memberId.trim()) {
      toast.error("Select a member first.");
      return;
    }
    setClearing(true);
    try {
      addLog(`CLEAR → DELETE /api/members/${memberId}/fingerprint-template`);
      const response = await fetch(
        `/api/members/${encodeURIComponent(memberId.trim())}/fingerprint-template`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Clear failed");
      addLog("CLEAR ← template deleted. Re-enroll now.");
      toast.success("Stored template cleared. Capture and click Enroll to re-enroll.");
      setMemberInfo((prev) => prev ? { ...prev, storedTemplate: null, hasTemplate: false, templateLength: 0 } : prev);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clear failed";
      toast.error(message);
      addLog(`ERROR clear: ${message}`);
    } finally {
      setClearing(false);
    }
  };

  const runMatch = async () => {
    if (!memberInfo) {
      toast.error("Load a member first.");
      addLog("MATCH blocked: no member loaded");
      return;
    }
    if (!memberInfo.storedTemplate) {
      console.warn("[fingerprint-diag] runMatch: storedTemplate is empty", {
        hasTemplate: memberInfo.hasTemplate,
        templateLength: memberInfo.templateLength,
      });
      toast.error(
        memberInfo.hasTemplate
          ? "Template found in DB but failed to load — check terminal logs."
          : "Member has no fingerprint enrolled. Capture then click Enroll.",
      );
      addLog(
        `MATCH blocked: storedTemplate null (hasTemplate=${memberInfo.hasTemplate} dbLen=${memberInfo.templateLength})`,
      );
      return;
    }
    if (!capture) {
      toast.error("Capture a live fingerprint first.");
      addLog("MATCH blocked: no live capture");
      return;
    }

    const liveNative = capture.NativeTemplateBase64 ?? null;
    const stored     = memberInfo.storedTemplate;

    console.log("[fingerprint-diag] runMatch starting", {
      storedLen: stored?.length ?? 0,
      nativeLen: liveNative?.length ?? 0,
    });
    addLog(
      `MATCH starting: storedLen=${stored?.length ?? 0} nativeLen=${liveNative?.length ?? 0}`,
    );

    if (!liveNative) {
      toast.error("No native template — is the bridge running? Capture again.");
      addLog("MATCH blocked: NativeTemplateBase64 is null (bridge may be down)");
      return;
    }

    const combinations: Array<{ label: string; t1: string; t2: string }> = [
      { label: "live self-match (should score ~199)", t1: liveNative, t2: liveNative },
    ];
    if (stored) {
      combinations.push({ label: "stored vs live", t1: stored, t2: liveNative });
    }

    if (combinations.length === 0) {
      toast.error("No valid template combinations.");
      addLog("MATCH blocked: all templates null");
      return;
    }

    setLoadingMatch(true);
    setResults([]);

    try {
      for (const combo of combinations) {
        console.log("[fingerprint-diag] match request", {
          label: combo.label,
          t1Preview: combo.t1.slice(0, 16),
          t2Preview: combo.t2.slice(0, 16),
          t1Len: combo.t1.length,
          t2Len: combo.t2.length,
        });
        addLog(`MATCH → "${combo.label}" t1Len=${combo.t1.length} t2Len=${combo.t2.length}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let response: Response;
        try {
          response = await fetch("/api/fingerprint/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template1: combo.t1, template2: combo.t2 }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const data = await response.json();

        console.log("[fingerprint-diag] match response", {
          label: combo.label,
          status: response.status,
          ok: response.ok,
          ErrorCode: data.ErrorCode,
          MatchingScore: data.MatchingScore,
          ErrorDescription: data.ErrorDescription,
          fullBody: data,
        });
        addLog(
          `MATCH ← "${combo.label}" status=${response.status} code=${data.ErrorCode ?? "n/a"} score=${data.MatchingScore ?? "n/a"} err="${data.ErrorDescription ?? data.error ?? "none"}"`,
        );

        const item: MatchResultItem = {
          label: combo.label,
          format: "ISO",
          template1: combo.t1,
          template2: combo.t2,
          ErrorCode: data.ErrorCode,
          ErrorDescription: data.ErrorDescription ?? data.error,
          MatchingScore: data.MatchingScore,
          ok: response.ok && data.ErrorCode === 0 && (data.MatchingScore ?? 0) >= 40,
        };
        setResults((prev) => [...prev, item]);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? "Match request timed out (15s). SecuGen service may be unresponsive."
            : error.message
          : "Fingerprint match test failed";
      console.error("[fingerprint-diag] match error", error);
      toast.error(message);
      addLog(`ERROR match: ${message}`);
    } finally {
      setLoadingMatch(false);
    }
  };

  const best = results.find((item) => item.ok);
  const templateMissing = memberInfo !== null && !memberInfo.storedTemplate;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Fingerprint Diagnostic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + load row */}
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void searchMembers()}
              placeholder="Search member number, name, or phone"
              className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <Button onClick={searchMembers} disabled={searchLoading}>
              {searchLoading ? "Searching..." : "Search"}
            </Button>
            <Button
              onClick={loadMember}
              disabled={loadingMember || !memberId.trim()}
              variant="secondary"
            >
              {loadingMember ? "Loading..." : "Load Member"}
            </Button>
            <Button onClick={captureLive} disabled={loadingCapture} variant="secondary">
              {loadingCapture ? "Scanning..." : "Capture Fingerprint"}
            </Button>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={runMatch} disabled={loadingMatch} variant="outline">
              {loadingMatch ? "Matching..." : "Run Match Tests"}
            </Button>

            {templateMissing && capture && (
              <Button
                onClick={enrollFromCapture}
                disabled={enrolling}
                variant="default"
                className="bg-amber-600 hover:bg-amber-700"
              >
                {enrolling ? "Enrolling..." : "Enroll Captured Fingerprint"}
              </Button>
            )}

            {memberInfo?.hasTemplate && (
              <Button
                onClick={clearTemplate}
                disabled={clearing}
                variant="destructive"
                size="sm"
              >
                {clearing ? "Clearing..." : "Clear & Re-enroll"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw((v) => !v)}
              className="ml-auto text-xs text-slate-500"
            >
              {showRaw ? "Hide raw" : "Show raw API"}
            </Button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 rounded-lg border bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Search Results — click to select
              </p>
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMemberId(item.id);
                    setMemberInfo(null);
                    setCapture(null);
                    setResults([]);
                    toast.success(`Selected ${item.memberNumber}`);
                    void loadMemberById(item.id);
                  }}
                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium">
                      {item.memberNumber} — {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.phone} • {item.branch}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">Select</span>
                </button>
              ))}
            </div>
          )}

          {/* Selected member ID */}
          <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
            Selected member ID:{" "}
            <span className="font-mono">{memberId || "(none)"}</span>
          </div>

          {/* No-template warning */}
          {templateMissing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>No fingerprint template enrolled.</strong>{" "}
              {memberInfo.hasTemplate
                ? "A template exists in the DB but failed to load — check terminal logs."
                : "This member has no fingerprint enrolled yet."}{" "}
              {capture
                ? "Click Enroll Captured Fingerprint to enroll the scan above."
                : "Capture a fingerprint first, then click Enroll."}
            </div>
          )}

          {/* Member info card */}
          {memberInfo && (
            <div className="grid gap-3 rounded-lg border bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-slate-500">Member number</p>
                <p className="font-medium">{memberInfo.memberNumber}</p>
              </div>
              <div>
                <p className="text-slate-500">Name</p>
                <p className="font-medium">{memberInfo.memberName || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">DB template length</p>
                <p className="font-medium">
                  {memberInfo.templateLength}{" "}
                  <span className={memberInfo.hasTemplate ? "text-emerald-600" : "text-red-500"}>
                    {memberInfo.hasTemplate ? "(enrolled)" : "(not enrolled)"}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-slate-500">Stored template loaded</p>
                <p className={memberInfo.storedTemplate ? "font-medium text-emerald-700" : "font-medium text-red-600"}>
                  {memberInfo.storedTemplate
                    ? `Yes (${memberInfo.storedTemplate.length} chars)`
                    : "No"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Template format</p>
                <p className={`font-medium ${
                  memberInfo.templateFormat === "ANSI-378" || memberInfo.templateFormat === "ISO-19794-2"
                    ? "text-amber-600"
                    : memberInfo.templateFormat === "native/unknown"
                      ? "text-emerald-700"
                      : "text-slate-400"
                }`}>
                  {memberInfo.templateFormat ?? (memberInfo.isISOFormat ? "FMR (ISO/ANSI)" : "unknown")}
                  {(memberInfo.templateFormat === "ANSI-378" || memberInfo.templateFormat === "ISO-19794-2") && (
                    <span className="ml-1 text-xs font-normal text-amber-500">
                      ⚠ Needs re-enrollment (not SG400)
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Enrollment quality</p>
                <p className="font-medium">{memberInfo.fingerprintQuality ?? "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Enrolled at</p>
                <p className="font-medium">
                  {memberInfo.fingerprintEnrolledAt
                    ? new Date(memberInfo.fingerprintEnrolledAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Adaptively updated at</p>
                <p className="font-medium">
                  {memberInfo.fingerprintUpdatedAt
                    ? new Date(memberInfo.fingerprintUpdatedAt).toLocaleString()
                    : "-"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-slate-500">Template preview (DB)</p>
                <p className="font-mono text-xs">{memberInfo.templatePreview}</p>
              </div>
            </div>
          )}

          {/* Live capture status */}
          {capture && (
            <div className={`rounded-lg border p-4 text-sm space-y-1 ${capture.NativeTemplateBase64 ? "bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <p>
                <strong>Live capture ready</strong> — quality {capture.ImageQuality}/100
              </p>
              <p className="text-xs text-slate-600">
                Native SG400:{" "}
                {capture.NativeTemplateBase64 ? (
                  <span className="text-emerald-700 font-medium">✓ 400 bytes ready</span>
                ) : (
                  <span className="text-red-600 font-medium">- MISSING</span>
                )}
                {capture.bridgeError && (
                  <span className="ml-2 text-amber-700">— {capture.bridgeError}</span>
                )}
              </p>
              <p className="text-xs text-slate-600">
                TemplateBase64 (SGIFPCapture):{" "}
                {capture.TemplateBase64 ? (
                  <>{capture.TemplateBase64.length} chars</>
                ) : (
                  <span className="text-red-600">MISSING</span>
                )}
              </p>
            </div>
          )}

          {/* Best match banner */}
          {best && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Match found: <strong>{best.label}</strong> — score{" "}
              <strong>{best.MatchingScore}</strong>
            </div>
          )}

          {/* Match results list */}
          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Match results
              </p>
              {results.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    item.ok ? "border-emerald-200 bg-emerald-50" : "border-red-100 bg-red-50"
                  }`}
                >
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      code={item.ErrorCode ?? "n/a"} | score={item.MatchingScore ?? "n/a"}
                      {item.ErrorDescription && ` | ${item.ErrorDescription}`}
                    </p>
                  </div>
                  <span className={item.ok ? "font-bold text-emerald-700" : "font-medium text-red-600"}>
                    {item.ok ? "MATCH" : "NO MATCH"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Raw API panel */}
          {showRaw && (rawDebug || rawTemplate) && (
            <div className="space-y-2 rounded-lg border bg-slate-900 p-4 font-mono text-xs text-green-300">
              <p className="font-bold text-slate-400">RAW API RESPONSES</p>
              {rawDebug && (
                <>
                  <p className="text-slate-400">─── /api/fingerprint/debug ───</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(rawDebug, null, 2)}
                  </pre>
                </>
              )}
              {rawTemplate && (
                <>
                  <p className="text-slate-400">─── /api/members/[id]/fingerprint-template ───</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(rawTemplate, null, 2)}
                  </pre>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-300">
            {logs.length === 0 ? (
              <p className="text-slate-500">Logs will appear here.</p>
            ) : (
              logs.map((log, i) => <p key={i}>{log}</p>)
            )}
          </div>
          {logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLogs([])}
              className="mt-2 text-xs text-slate-400"
            >
              Clear log
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

