"use client";

import { useState } from "react";
import { Fingerprint, Loader2, RotateCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    setMessage("Place finger firmly on the scanner...");
    setPreview(null);
    setQuality(null);

    try {
      const data = await captureFingerprint();

      if (data.ImageQuality < 50) {
        setStatus("error");
        setMessage(
          `Quality too low (${data.ImageQuality}/100). Clean finger and try again.`,
        );
        return;
      }

      setPreview(`data:image/bmp;base64,${data.BMPBase64}`);
      setQuality(data.ImageQuality);

      if (!data.NativeTemplateBase64) {
        setStatus("error");
        setMessage(
          data.bridgeError ||
            "Native template unavailable — start fingerprint-bridge/server.js and retry.",
        );
        return;
      }

      setStatus("done");
      setMessage(
        `Fingerprint captured successfully. Quality: ${data.ImageQuality}/100`,
      );
      onCapture(data);
    } catch (error: unknown) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unknown scanner error.");
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
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-700">{label}</p>
        </div>
        {status !== "idle" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 text-xs text-slate-500"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col items-center">
          <div className="mb-4 w-full max-w-[320px] rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="flex min-h-[230px] items-center justify-center overflow-hidden rounded-[22px] bg-white">
              {preview ? (
                <img
                  src={preview}
                  alt="Fingerprint preview"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  {status === "scanning" ? (
                    <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                      <ScanLine className="h-10 w-10" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-600">
                      {status === "scanning"
                        ? "Scanning in progress"
                        : "Enrollment Scan"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {status === "scanning"
                        ? "Keep finger steady on the scanner"
                        : "Capture the member fingerprint template"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {quality !== null && (
            <div className="mb-4 w-full max-w-[520px]">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>Quality</span>
                <span>{quality}/100</span>
              </div>
              <div className="h-3 rounded-full bg-slate-200">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    quality >= 80
                      ? "bg-emerald-500"
                      : quality >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${quality}%` }}
                />
              </div>
            </div>
          )}

          {message && (
            <p
              className={`mb-4 min-h-10 text-center text-sm ${
                status === "error"
                  ? "text-rose-600"
                  : status === "done"
                    ? "text-emerald-600"
                    : "text-slate-500"
              }`}
            >
              {message}
            </p>
          )}

          <Button
            type="button"
            onClick={handleScan}
            disabled={disabled || status === "scanning"}
            className="h-12 w-full max-w-[520px] bg-emerald-600 text-base font-medium text-white hover:bg-emerald-700"
          >
            {status === "scanning" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Fingerprint className="mr-2 h-4 w-4" />
                Capture Fingerprint
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
