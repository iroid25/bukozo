"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Shield, User } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import FingerprintScanner from "@/components/FingerprintScanner";
import { type FingerprintCapture } from "@/lib/fingerprint";

export default function FingerprintReEnrollClient({
  userId,
  memberName,
  memberNumber,
  hasFingerprint,
}: {
  userId: string;
  memberName: string;
  memberNumber: string;
  hasFingerprint: boolean;
}) {
  const router = useRouter();
  const [capture, setCapture] = useState<FingerprintCapture | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!capture) {
      toast.error("Please capture the fingerprint first.");
      return;
    }

    if (!capture.NativeTemplateBase64) {
      toast.error(capture.bridgeError || "Native template missing — bridge not running.", {
        description: "Start fingerprint-bridge/server.js and retry the scan.",
      });
      return;
    }

    console.log("[reenroll] NativeTemplateBase64 length:", capture.NativeTemplateBase64.length);

    setSaving(true);
    try {
      const response = await fetch("/api/v1/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          fingerprintTemplate: capture.NativeTemplateBase64,
          fingerprintQuality: capture.ImageQuality,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to update fingerprint");
      }

      toast.success("Fingerprint updated successfully");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fingerprint update failed",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard/users/members">
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Members
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">
              Re-enroll Fingerprint
            </h1>
            <p className="mt-2 text-muted-foreground">
              Update the stored fingerprint for {memberName} ({memberNumber}).
            </p>
          </div>
          <div className="rounded-full border bg-muted px-4 py-2 text-sm">
            {hasFingerprint ? "Fingerprint enrolled" : "No fingerprint yet"}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Member Fingerprint</h2>
          </div>

          <div className="mb-6 rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="h-4 w-4" />
              <span>{memberName}</span>
            </div>
          </div>

          <FingerprintScanner
            label="Enrollment Scan"
            onCapture={setCapture}
            onReset={() => setCapture(null)}
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {capture
                ? `Ready to save. Quality: ${capture.ImageQuality}/100`
                : "Capture a fresh scan to replace or add the member fingerprint."}
            </p>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !capture}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? "Saving..." : "Save Fingerprint"}
            </Button>
          </div>

          {capture && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle className="mr-2 inline h-4 w-4" />
              New fingerprint captured and ready to store.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
