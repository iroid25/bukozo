# SACCO Fingerprint Integration — Full Implementation Instructions

# For: Codex / AI Coding Agent

# Device: SecuGen Hamster IV (HFDU04/HSDU04P)

# Stack: Next.js (App Router) + Prisma ORM + PostgreSQL + Tailwind CSS + shadcn/ui

---

## CONTEXT

This is a SACCO (savings & credit cooperative) management web app built with Next.js App Router.
The teller PC has:

- SecuGen Hamster IV fingerprint scanner plugged in via USB
- SgiBioSrv service running on **http://localhost:8000** (HTTP, NOT https)
- The browser calls http://localhost:8000 directly from the client side

The fingerprint flow has two parts:

1. **Enrollment** — when creating a new member, capture and store their fingerprint template
2. **Verification** — when a member requests a withdrawal, scan their finger and match against stored template before allowing the transaction

---

## PART 1 — PRISMA SCHEMA CHANGES

Open `prisma/schema.prisma`.

Find the `Member` model and ensure it has these fingerprint fields. Add any that are missing:

```prisma
model Member {
  // ... keep all existing fields ...

  fingerprintTemplate   String?    // stores ISOTemplateBase64 from SecuGen
  fingerprintQuality    Int?       // 0–100 quality score at enrollment time
  fingerprintEnrolledAt DateTime?  // timestamp of enrollment

  fingerprintLogs FingerprintLog[] // add this relation if not present
}
```

Create the `FingerprintLog` model if it does not exist:

```prisma
model FingerprintLog {
  id        Int      @id @default(autoincrement())
  memberId  String   // match the type of Member.id in your schema
  action    String   // "ENROLL" | "VERIFY_SUCCESS" | "VERIFY_FAIL"
  quality   Int?
  score     Int?
  ipAddress String?
  createdAt DateTime @default(now())

  member Member @relation(fields: [memberId], references: [id])
}
```

After editing the schema run:

```bash
npx prisma migrate dev --name add_fingerprint_fields
npx prisma generate
```

---

## PART 2 — FINGERPRINT UTILITY FILE

Create the file `lib/fingerprint.ts` with this exact content:

```ts
// lib/fingerprint.ts
const SGIBIOSRV = "http://localhost:8000"; // HTTP not HTTPS

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
  ISOTemplateBase64: string; // use this for storage and matching
  TemplateBase64: string;
}

export interface MatchResult {
  ErrorCode: number;
  MatchingScore: number; // >= 40 means fingerprints match
}

/**
 * Capture a fingerprint from the Hamster IV via SgiBioSrv.
 * Call this from client components only ("use client").
 * Throws if the service is not running or no finger is placed.
 */
export async function captureFingerprint(): Promise<FingerprintCapture> {
  let res: Response;
  try {
    res = await fetch(`${SGIBIOSRV}/SGIFPCapture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Timeout: 10000,
        Quality: 60,
        TemplateFormat: "ISO",
      }),
    });
  } catch {
    throw new Error(
      "Cannot reach fingerprint service. Make sure SgiBioSrv is running on this PC.",
    );
  }
  if (!res.ok) throw new Error("SgiBioSrv returned an error response.");
  const data: FingerprintCapture = await res.json();
  if (data.ErrorCode !== 0) {
    throw new Error(
      `Scanner error ${data.ErrorCode}: ${data.ErrorDescription ?? "Unknown error"}`,
    );
  }
  return data;
}

/**
 * 1:1 match — compare a stored template against a live scan.
 * Both templates must be ISO format (ISOTemplateBase64).
 * MatchingScore >= 40 means it is the same person.
 */
export async function matchFingerprints(
  storedTemplate: string,
  liveTemplate: string,
): Promise<MatchResult> {
  let res: Response;
  try {
    res = await fetch(`${SGIBIOSRV}/SGIMatchScore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Template1: storedTemplate,
        Template2: liveTemplate,
        TemplateFormat: "ISO",
      }),
    });
  } catch {
    throw new Error(
      "Cannot reach fingerprint matching service. Make sure SgiBioSrv is running.",
    );
  }
  if (!res.ok) throw new Error("Matching service error.");
  return res.json();
}
```

---

## PART 3 — REUSABLE FINGERPRINT SCANNER COMPONENT

Create the file `components/FingerprintScanner.tsx`:

```tsx
"use client";
import { useState } from "react";
import { captureFingerprint, type FingerprintCapture } from "@/lib/fingerprint";

interface Props {
  label?: string;
  onCapture: (data: FingerprintCapture) => void;
  onReset?: () => void;
  disabled?: boolean;
}

export default function FingerprintScanner({
  label = "Scan Fingerprint",
  onCapture,
  onReset,
  disabled = false,
}: Props) {
  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">(
    "idle",
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [quality, setQuality] = useState<number | null>(null);

  const handleScan = async () => {
    setStatus("scanning");
    setMessage("Place finger firmly on the Hamster IV scanner...");
    setPreview(null);
    setQuality(null);

    try {
      const data = await captureFingerprint();

      if (data.ImageQuality < 60) {
        setStatus("error");
        setMessage(
          `Quality too low (${data.ImageQuality}/100). Clean finger and try again.`,
        );
        return;
      }

      setPreview(`data:image/bmp;base64,${data.BMPBase64}`);
      setQuality(data.ImageQuality);
      setStatus("done");
      setMessage(`Captured successfully — Quality: ${data.ImageQuality}/100`);
      onCapture(data);
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Unknown scanner error.");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setPreview(null);
    setMessage("");
    setQuality(null);
    onReset?.();
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5 w-64">
      <p className="text-sm font-semibold text-gray-700">{label}</p>

      {/* Fingerprint preview box */}
      <div className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-white">
        {preview ? (
          <img
            src={preview}
            alt="Fingerprint preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 2C8 2 5 5 5 9c0 5 4 11 7 13 3-2 7-8 7-13 0-4-3-7-7-7z" />
              <path d="M12 6c-2 0-3 1.5-3 3 0 2.5 1.5 5 3 7 1.5-2 3-4.5 3-7 0-1.5-1-3-3-3z" />
            </svg>
            <span className="text-xs text-center">No scan yet</span>
          </div>
        )}
      </div>

      {/* Quality bar */}
      {quality !== null && (
        <div className="w-full">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Quality</span>
            <span>{quality}/100</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                quality >= 80
                  ? "bg-green-500"
                  : quality >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${quality}%` }}
            />
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <p
          className={`text-xs text-center min-h-[2rem] ${
            status === "error"
              ? "text-red-500"
              : status === "done"
                ? "text-green-600"
                : "text-gray-500"
          }`}
        >
          {message}
        </p>
      )}

      {/* Buttons */}
      {status !== "done" ? (
        <button
          onClick={handleScan}
          disabled={disabled || status === "scanning"}
          className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "scanning" ? "⏳ Scanning..." : "🖐 Scan Fingerprint"}
        </button>
      ) : (
        <button
          onClick={handleReset}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
        >
          🔄 Re-scan
        </button>
      )}
    </div>
  );
}
```

---

## PART 4 — FINGERPRINT TEST PAGE

Create the file `app/fingerprint-test/page.tsx`.
This page lets the teller test that the device is working before going live:

```tsx
"use client";
import { useState } from "react";
import FingerprintScanner from "@/components/FingerprintScanner";
import { matchFingerprints, type FingerprintCapture } from "@/lib/fingerprint";

export default function FingerprintTestPage() {
  const [scan1, setScan1] = useState<FingerprintCapture | null>(null);
  const [scan2, setScan2] = useState<FingerprintCapture | null>(null);
  const [matchResult, setMatchResult] = useState<{
    score: number;
    match: boolean;
  } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");

  const handleMatch = async () => {
    if (!scan1 || !scan2) return;
    setMatchLoading(true);
    setMatchResult(null);
    setMatchError("");

    try {
      const result = await matchFingerprints(
        scan1.ISOTemplateBase64,
        scan2.ISOTemplateBase64,
      );
      if (result.ErrorCode !== 0) {
        setMatchError(`Matching error code: ${result.ErrorCode}`);
      } else {
        setMatchResult({
          score: result.MatchingScore,
          match: result.MatchingScore >= 40,
        });
      }
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : "Match failed.");
    } finally {
      setMatchLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          🖐 Fingerprint Device Test
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Use this page to verify your Hamster IV scanner is working correctly
          before going live.
        </p>
      </div>

      {/* Service status check */}
      <ServiceStatusCheck />

      {/* Two scan boxes for match testing */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">
          Match Test (Scan Same Finger Twice)
        </h2>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">SCAN 1</p>
            <FingerprintScanner
              label="First Scan"
              onCapture={setScan1}
              onReset={() => {
                setScan1(null);
                setMatchResult(null);
              }}
            />
            {scan1 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Template: {scan1.ISOTemplateBase64.length} chars
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">SCAN 2</p>
            <FingerprintScanner
              label="Second Scan"
              onCapture={setScan2}
              onReset={() => {
                setScan2(null);
                setMatchResult(null);
              }}
            />
            {scan2 && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Template: {scan2.ISOTemplateBase64.length} chars
              </p>
            )}
          </div>
        </div>

        {scan1 && scan2 && (
          <button
            onClick={handleMatch}
            disabled={matchLoading}
            className="w-full rounded-lg bg-purple-700 py-3 text-white font-semibold hover:bg-purple-800 transition disabled:opacity-50"
          >
            {matchLoading ? "Matching..." : "Compare Fingerprints"}
          </button>
        )}

        {matchResult && (
          <div
            className={`rounded-xl p-4 text-center ${
              matchResult.match
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <p className="text-3xl font-bold">
              {matchResult.match ? "✅ MATCH" : "❌ NO MATCH"}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Matching Score: <strong>{matchResult.score}</strong> / 199
              &nbsp;(threshold: 40)
            </p>
          </div>
        )}

        {matchError && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            {matchError}
          </p>
        )}
      </div>

      {/* Raw capture data */}
      {scan1 && (
        <div className="bg-gray-900 rounded-xl p-4 text-green-400 text-xs overflow-auto max-h-48">
          <p className="text-gray-500 mb-2">Raw capture data (Scan 1):</p>
          <pre>
            {JSON.stringify(
              {
                ErrorCode: scan1.ErrorCode,
                Manufacturer: scan1.Manufacturer,
                Model: scan1.Model,
                SerialNumber: scan1.SerialNumber,
                ImageQuality: scan1.ImageQuality,
                NFIQ: scan1.NFIQ,
                ImageDPI: scan1.ImageDPI,
                ISOTemplateBase64:
                  scan1.ISOTemplateBase64.substring(0, 60) + "...",
              },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

// Inner component — checks if SgiBioSrv is reachable
function ServiceStatusCheck() {
  const [status, setStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState("");

  const check = async () => {
    setLoading(true);
    setStatus("unknown");
    setDetail("");
    try {
      const res = await fetch("http://localhost:8000/SGIFPCapture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Timeout: 1000,
          Quality: 60,
          TemplateFormat: "ISO",
        }),
      });
      const data = await res.json();
      // ErrorCode 10004 = no device, 0 = device present, both mean service is running
      if (
        data.ErrorCode === 0 ||
        data.ErrorCode === 10004 ||
        data.ErrorCode === 51
      ) {
        setStatus("ok");
        setDetail(
          data.ErrorCode === 0
            ? "Device connected and ready"
            : "Service running — plug in your Hamster IV",
        );
      } else {
        setStatus("ok");
        setDetail(`Service running (code ${data.ErrorCode})`);
      }
    } catch {
      setStatus("error");
      setDetail(
        'Cannot reach http://localhost:8000 — open CMD as Admin and run: cd "C:\\Program Files (x86)\\SecuGen\\SgiBioSrv" && sgibiosrv.exe start',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
      <div className="flex-1">
        <h2 className="font-semibold text-gray-800 mb-1">
          SgiBioSrv Service Status
        </h2>
        <p className="text-xs text-gray-500">
          Checks if the fingerprint service is running on this PC
          (http://localhost:8000)
        </p>
        {detail && (
          <p
            className={`text-sm mt-2 ${
              status === "ok" ? "text-green-700" : "text-red-600"
            }`}
          >
            {detail}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div
          className={`w-4 h-4 rounded-full ${
            status === "ok"
              ? "bg-green-500"
              : status === "error"
                ? "bg-red-500"
                : "bg-gray-300"
          }`}
        />
        <button
          onClick={check}
          disabled={loading}
          className="text-xs rounded-lg bg-gray-100 px-3 py-1.5 hover:bg-gray-200 transition disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check"}
        </button>
      </div>
    </div>
  );
}
```

---

## PART 5 — API ROUTES

### 5A — Enroll Fingerprint

Create `app/api/members/enroll-fingerprint/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { memberId, templateBase64, quality } = body;

  if (!memberId || !templateBase64) {
    return NextResponse.json(
      { error: "memberId and templateBase64 are required." },
      { status: 400 },
    );
  }

  if (quality < 60) {
    return NextResponse.json(
      {
        error: `Fingerprint quality too low (${quality}/100). Ask member to rescan.`,
      },
      { status: 422 },
    );
  }

  await prisma.member.update({
    where: { id: memberId },
    data: {
      fingerprintTemplate: templateBase64,
      fingerprintQuality: quality,
      fingerprintEnrolledAt: new Date(),
    },
  });

  await prisma.fingerprintLog.create({
    data: {
      memberId,
      action: "ENROLL",
      quality,
      ipAddress: req.headers.get("x-forwarded-for") ?? "",
    },
  });

  return NextResponse.json({ success: true });
}
```

### 5B — Get Fingerprint Template (for matching during withdrawal)

Create `app/api/members/[id]/fingerprint-template/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    select: {
      fingerprintTemplate: true,
      name: true, // adjust field name to match your schema
      balance: true, // adjust if your balance field is named differently
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (!member.fingerprintTemplate) {
    return NextResponse.json(
      { error: "No fingerprint enrolled for this member. Enroll first." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    template: member.fingerprintTemplate,
    name: member.name,
    balance: member.balance,
  });
}
```

### 5C — Process Withdrawal (after fingerprint verified)

Create `app/api/withdrawals/route.ts` (or add POST to existing file):

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MATCH_THRESHOLD = 40;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { memberId, amount, matchScore } = body;

  if (!memberId || !amount || matchScore === undefined) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 },
    );
  }

  // Server-side guard — never trust client alone
  if (matchScore < MATCH_THRESHOLD) {
    await prisma.fingerprintLog.create({
      data: {
        memberId,
        action: "VERIFY_FAIL",
        score: matchScore,
        ipAddress: req.headers.get("x-forwarded-for") ?? "",
      },
    });
    return NextResponse.json(
      {
        error: `Fingerprint verification failed (score: ${matchScore}/199). Minimum required: ${MATCH_THRESHOLD}.`,
      },
      { status: 403 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: memberId } });

      if (!member) throw new Error("Member not found.");
      if ((member.balance ?? 0) < amount)
        throw new Error("Insufficient balance.");

      const updated = await tx.member.update({
        where: { id: memberId },
        data: { balance: { decrement: amount } },
      });

      // Create withdrawal record — adjust model name to match your schema
      const withdrawal = await tx.withdrawal.create({
        data: {
          memberId,
          amount,
          balanceBefore: member.balance,
          balanceAfter: updated.balance,
          verifiedByFingerprint: true,
          matchScore,
          status: "APPROVED",
        },
      });

      await tx.fingerprintLog.create({
        data: {
          memberId,
          action: "VERIFY_SUCCESS",
          score: matchScore,
          ipAddress: req.headers.get("x-forwarded-for") ?? "",
        },
      });

      return { withdrawal, newBalance: updated.balance };
    });

    return NextResponse.json({
      success: true,
      withdrawalId: result.withdrawal.id,
      newBalance: result.newBalance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transaction failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

---

## PART 6 — UPDATE THE CREATE MEMBER PAGE/FORM

Find your existing member creation page (based on the pasted form it is likely at `app/members/new/page.tsx` or similar).

Make these changes to that file:

1. Add this import at the top:

```tsx
import FingerprintScanner from "@/components/FingerprintScanner";
import type { FingerprintCapture } from "@/lib/fingerprint";
```

2. Add fingerprint state inside the component:

```tsx
const [fpData, setFpData] = useState<FingerprintCapture | null>(null);
```

3. Inside the form JSX, add the FingerprintScanner before the submit button:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    Enroll Fingerprint{" "}
    <span className="text-gray-400 font-normal">
      (Right Index Finger recommended)
    </span>
  </label>
  <FingerprintScanner
    label="Enrollment Scan"
    onCapture={setFpData}
    onReset={() => setFpData(null)}
  />
  {fpData && (
    <p className="text-xs text-green-600">
      ✓ Fingerprint ready to enroll (Quality: {fpData.ImageQuality}/100)
    </p>
  )}
  {!fpData && (
    <p className="text-xs text-amber-600">
      ⚠ Fingerprint is required to create a member
    </p>
  )}
</div>
```

4. Update the submit button to be disabled if no fingerprint:

```tsx
disabled={loading || !fpData}
```

5. Update the submit handler. After the member is created (you get back a memberId), immediately call the enroll endpoint:

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!fpData) {
    toast.error("Please scan the member's fingerprint before saving.");
    return;
  }

  setLoading(true);

  try {
    // Step 1 — Create the member (your existing API call)
    const memberRes = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData), // your existing form data object
    });

    if (!memberRes.ok) {
      const err = await memberRes.json();
      throw new Error(err.error ?? "Failed to create member.");
    }

    const { id: memberId } = await memberRes.json(); // adjust to actual response shape

    // Step 2 — Enroll fingerprint
    const enrollRes = await fetch("/api/members/enroll-fingerprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        templateBase64: fpData.ISOTemplateBase64,
        quality: fpData.ImageQuality,
      }),
    });

    if (!enrollRes.ok) {
      const err = await enrollRes.json();
      throw new Error(err.error ?? "Fingerprint enrollment failed.");
    }

    toast.success("Member created and fingerprint enrolled successfully!");
    router.push("/members"); // adjust redirect as needed
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : "Something went wrong.");
  } finally {
    setLoading(false);
  }
};
```

---

## PART 7 — WITHDRAWAL PAGE WITH FINGERPRINT VERIFICATION

Create `app/withdrawals/new/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import FingerprintScanner from "@/components/FingerprintScanner";
import { matchFingerprints, type FingerprintCapture } from "@/lib/fingerprint";

interface MemberInfo {
  name: string;
  balance: number;
  template: string;
}

export default function WithdrawalPage() {
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [liveFP, setLiveFP] = useState<FingerprintCapture | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Step 1 — look up member and load their stored template
  const lookupMember = async () => {
    if (!memberId.trim()) return;
    setLookupLoading(true);
    setMemberInfo(null);
    setResult(null);
    setLiveFP(null);

    try {
      const res = await fetch(`/api/members/${memberId}/fingerprint-template`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setMemberInfo(data);
    } catch (err: unknown) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Member lookup failed.",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  // Step 2 — after live scan, match and process withdrawal
  const handleWithdraw = async () => {
    if (!liveFP || !memberInfo || !amount) return;

    setLoading(true);
    setResult(null);

    try {
      // Match fingerprints client-side via SgiBioSrv
      const match = await matchFingerprints(
        memberInfo.template,
        liveFP.ISOTemplateBase64,
      );

      if (match.ErrorCode !== 0) {
        throw new Error(`Matching service error (code ${match.ErrorCode}).`);
      }

      if (match.MatchingScore < 40) {
        setResult({
          type: "error",
          message: `❌ Fingerprint does not match (score: ${match.MatchingScore}/199). Withdrawal denied.`,
        });
        setLoading(false);
        return;
      }

      // Fingerprint matched — submit withdrawal to server
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          amount: parseFloat(amount),
          matchScore: match.MatchingScore,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult({
        type: "success",
        message: `✅ Withdrawal of UGX ${parseFloat(amount).toLocaleString()} approved! New balance: UGX ${data.newBalance.toLocaleString()}. Ref: #${data.withdrawalId}`,
      });

      // Reset form
      setMemberId("");
      setAmount("");
      setMemberInfo(null);
      setLiveFP(null);
    } catch (err: unknown) {
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Withdrawal failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Process Withdrawal</h1>
        <p className="text-sm text-gray-500">
          Member must verify identity with fingerprint before withdrawal is
          approved.
        </p>
      </div>

      {/* Step 1 — Member lookup */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Step 1 — Find Member</h2>
        <div className="flex gap-2">
          <input
            placeholder="Enter Member ID"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupMember()}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={lookupMember}
            disabled={lookupLoading || !memberId.trim()}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition disabled:opacity-50"
          >
            {lookupLoading ? "..." : "Lookup"}
          </button>
        </div>

        {memberInfo && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="font-semibold text-gray-900">{memberInfo.name}</p>
            <p className="text-sm text-gray-600">
              Available Balance:{" "}
              <strong>UGX {memberInfo.balance.toLocaleString()}</strong>
            </p>
          </div>
        )}
      </div>

      {/* Step 2 — Amount */}
      {memberInfo && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">Step 2 — Enter Amount</h2>
          <input
            placeholder="Amount (UGX)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          {amount && parseFloat(amount) > memberInfo.balance && (
            <p className="text-red-600 text-xs">
              Amount exceeds available balance.
            </p>
          )}
        </div>
      )}

      {/* Step 3 — Fingerprint scan */}
      {memberInfo && amount && parseFloat(amount) <= memberInfo.balance && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800">
            Step 3 — Member Fingerprint Verification
          </h2>
          <p className="text-xs text-gray-500">
            Ask the member to place their enrolled finger on the Hamster IV
            scanner.
          </p>
          <FingerprintScanner
            label="Live Verification Scan"
            onCapture={setLiveFP}
            onReset={() => setLiveFP(null)}
          />
        </div>
      )}

      {/* Final action */}
      {liveFP && memberInfo && amount && (
        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full rounded-xl bg-red-700 py-3 text-white font-bold text-sm hover:bg-red-800 transition disabled:opacity-50"
        >
          {loading
            ? "Verifying & Processing..."
            : "✓ Verify & Process Withdrawal"}
        </button>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl p-4 text-sm ${
            result.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
```

---

## PART 8 — NEXT.JS CONFIG (Mixed Content Fix)

Open or create `next.config.js` (or `next.config.ts`) in the project root.

Add the Content-Security-Policy header to allow calls to http://localhost:8000:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... keep any existing config ...

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "connect-src 'self' http://localhost:8000 ws://localhost:3000;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

---

## PART 9 — WITHDRAWAL MODEL IN PRISMA (if it doesn't exist)

If your schema does not have a `Withdrawal` model, add this:

```prisma
model Withdrawal {
  id                   Int      @id @default(autoincrement())
  memberId             String
  amount               Float
  balanceBefore        Float
  balanceAfter         Float
  verifiedByFingerprint Boolean @default(false)
  matchScore           Int?
  status               String   @default("PENDING") // PENDING | APPROVED | REJECTED
  processedAt          DateTime @default(now())

  member Member @relation(fields: [memberId], references: [id])
}
```

Also add to the Member model:

```prisma
withdrawals Withdrawal[]
```

Then run:

```bash
npx prisma migrate dev --name add_withdrawal_model
npx prisma generate
```

---

## IMPORTANT NOTES FOR CODEX

1. **Field name alignment** — The Member model `id` field type may be `String` (cuid) or `Int`. Match the `memberId` type in FingerprintLog and Withdrawal to whatever type `Member.id` is.

2. **Member name field** — The API route at Part 5B uses `member.name`. Change this to whatever the name field is actually called in your Member model (e.g. `fullName`, `firstName`, etc.).

3. **Balance field** — If balance is not on the Member model (e.g. it's computed from transactions), remove the balance decrement from the withdrawal API and handle it according to your existing balance logic.

4. **Existing member creation API** — Do not replace the existing `/api/members` POST route. Only add the fingerprint enroll call AFTER a successful member creation response.

5. **Template field to store** — Always store `ISOTemplateBase64` from the capture response, not `TemplateBase64`. Use `ISOTemplateBase64` in both enrollment and matching.

6. **SgiBioSrv must run on HTTP** — All fetch calls to the fingerprint service use `http://localhost:8000`, never `https://`.

7. **Test page route** — The test page at `app/fingerprint-test/page.tsx` is accessible at `/fingerprint-test`. Add a link to it in your admin nav for easy access.

8. **Never skip fingerprint on withdrawal** — The withdrawal API route must always check `matchScore >= 40` server-side, even if the client says it matched. This prevents bypass attacks.

---

## SUMMARY OF FILES TO CREATE/MODIFY

| Action        | File                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| MODIFY        | `prisma/schema.prisma` — add fingerprint fields + FingerprintLog model |
| CREATE        | `lib/fingerprint.ts`                                                   |
| CREATE        | `components/FingerprintScanner.tsx`                                    |
| CREATE        | `app/fingerprint-test/page.tsx`                                        |
| CREATE        | `app/api/members/enroll-fingerprint/route.ts`                          |
| CREATE        | `app/api/members/[id]/fingerprint-template/route.ts`                   |
| CREATE/MODIFY | `app/api/withdrawals/route.ts` — add POST handler                      |
| MODIFY        | existing member create page — add FingerprintScanner + enroll call     |
| CREATE        | `app/withdrawals/new/page.tsx`                                         |
| MODIFY        | `next.config.js` — add CSP header                                      |

Run `npx prisma migrate dev` and `npx prisma generate` after all schema changes.
