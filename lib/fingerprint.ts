export interface FingerprintCapture {
  ErrorCode: number;
  ErrorDescription?: string;
  Manufacturer: string;
  Model: string;
  SerialNumber: string;
  ImageWidth: number;
  ImageHeight: number;
  ImageDPI: number;
  ImageQuality: number;
  NFIQ: number;
  BMPBase64: string;
  ISOTemplateBase64: string;
  TemplateBase64: string;
  // 400-byte SG400 native template from bridge — required for matching/storage
  NativeTemplateBase64?: string | null;
  bridgeError?: string | null;
}

export interface MatchResult {
  ErrorCode: number;
  MatchingScore: number;
  matched?: boolean;
  needsReEnrollment?: boolean;
}

export function normalizeFingerprintTemplate(
  template: string | null | undefined,
): string {
  return (template || "").replace(/\s+/g, "").trim();
}

export function isLikelyFingerprintTemplate(template: string | null | undefined) {
  const normalized = normalizeFingerprintTemplate(template);
  return normalized.length >= 64 && normalized.length <= 20000;
}

export function fingerprintTemplatePreview(
  template: string | null | undefined,
  length = 12,
): string {
  const normalized = normalizeFingerprintTemplate(template);
  if (!normalized) return "(empty)";
  return `${normalized.slice(0, length)}...(${normalized.length})`;
}

export function isFingerprintMatchFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Fingerprint could not be matched") ||
      error.message.includes("Matching service returned code 100") ||
      error.message.includes("Fingerprint match failed"))
  );
}

const BRIDGE_LOCAL = "http://localhost:8001";

// Browser calls bridge directly (CORS enabled). Works for remote deployments.
// Bridge handles SgiBioSrv internally — no CORS issue with SgiBioSrv.
export async function captureFingerprint(): Promise<FingerprintCapture> {
  try {
    const res = await fetch(`${BRIDGE_LOCAL}/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Bridge returned ${res.status}`);
    const data = await res.json() as FingerprintCapture & { error?: string };
    if (data.ErrorCode === 0) return data;
    throw new Error(`Scanner error ${data.ErrorCode}: ${data.ErrorDescription ?? "Unknown"}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Scanner error")) throw err;
    throw new Error(
      "Fingerprint bridge not running. Start fingerprint-bridge/server.js on this PC.",
    );
  }
}

// Direct bridge match — only used server-side (from API routes)
export async function matchTemplatesViaBridge(
  template1: string,
  template2: string,
): Promise<{ errorCode: number; score: number; matched: boolean }> {
  const BRIDGE = "http://127.0.0.1:8001";
  const res = await fetch(`${BRIDGE}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template1, template2 }),
    signal: AbortSignal.timeout(10000),
  });
  return res.json();
}

// Client-side match — tries server proxy first, falls back to direct bridge call
// if the server can't reach the bridge (remote deployment).
export async function matchFingerprintCapture(
  storedTemplate: string,
  capture: Pick<FingerprintCapture, "TemplateBase64" | "ImageQuality" | "NativeTemplateBase64">,
  memberId?: string,
): Promise<MatchResult> {
  const cleanStored = normalizeFingerprintTemplate(storedTemplate);

  if (!cleanStored) {
    throw new Error(
      "No stored fingerprint template found for this member. Please re-enroll.",
    );
  }
  if (!capture.NativeTemplateBase64) {
    throw new Error(
      "Bridge not running — start fingerprint-bridge/server.js and retry the scan.",
    );
  }
  const liveTemplate = normalizeFingerprintTemplate(capture.NativeTemplateBase64);

  const response = await fetch("/api/fingerprint/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template1:   cleanStored,
      template2:   liveTemplate,
      memberId,
      liveQuality: capture.ImageQuality,
    }),
  });

  const data = await response.json() as MatchResult & { error?: string };

  // If the server-side bridge is unavailable (remote deployment), call the local bridge directly
  if (response.status === 503) {
    return matchViaLocalBridge(cleanStored, liveTemplate, memberId, capture.ImageQuality);
  }

  if (!response.ok) throw new Error(data?.error || "Matching failed.");
  return data as MatchResult;
}

async function matchViaLocalBridge(
  t1: string,
  t2: string,
  memberId?: string,
  quality?: number,
): Promise<MatchResult> {
  type BridgeResult = { errorCode: number; score: number; matched: boolean; error?: string };
  let result: BridgeResult;
  try {
    const res = await fetch(`${BRIDGE_LOCAL}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template1: t1, template2: t2 }),
      signal: AbortSignal.timeout(10000),
    });
    result = await res.json() as BridgeResult;
  } catch {
    throw new Error(
      "Cannot reach fingerprint bridge at localhost:8001. Start fingerprint-bridge/server.js.",
    );
  }

  if (result.errorCode !== 0) {
    return { ErrorCode: result.errorCode, MatchingScore: result.score ?? 0, matched: false };
  }

  // Fire-and-forget adaptive update so the DB stays fresh after a client-side match
  if (result.matched && memberId && (quality ?? 0) >= 60) {
    fetch("/api/fingerprint/adaptive-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, liveTemplate: t2, liveQuality: quality }),
    }).catch(() => {});
  }

  return { ErrorCode: 0, MatchingScore: result.score, matched: result.matched };
}

// Legacy alias — kept for callers that pass two template strings directly
export async function matchFingerprints(
  storedTemplate: string,
  liveTemplate: string,
): Promise<MatchResult> {
  const cleanStored = normalizeFingerprintTemplate(storedTemplate);
  const cleanLive   = normalizeFingerprintTemplate(liveTemplate);

  if (!cleanStored) throw new Error("No stored fingerprint template. Please re-enroll.");
  if (!cleanLive)   throw new Error("Live fingerprint capture is empty. Please scan again.");

  const response = await fetch("/api/fingerprint/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template1: cleanStored, template2: cleanLive }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Matching service error.");

  const result = data as MatchResult;
  if (result.ErrorCode && result.ErrorCode !== 0) {
    throw new Error(
      `Fingerprint match failed with code ${result.ErrorCode}. Please scan again or re-enroll.`,
    );
  }
  return result;
}
