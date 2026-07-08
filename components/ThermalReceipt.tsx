"use client";

import { Silkscreen } from "next/font/google";

const pixelFont = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export interface ReceiptLineItem {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}

export interface ThermalReceiptProps {
  size?: "58mm" | "80mm";
  orderNumber: string;
  date: string;
  items: ReceiptLineItem[];
  total: string;
  totalLabel?: string;
  footerLines?: string[];
  /** number of zigzag teeth along top/bottom */
  teeth?: number;
}

function buildZigzag(teeth: number, toothPx: number): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x}% ${i % 2 === 0 ? "0px" : `${toothPx}px`}`);
    bottom.unshift(`${x}% ${i % 2 === 0 ? "calc(100% - 0px)" : `calc(100% - ${toothPx}px)`}`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

const SACCO = {
  name: "BUKONZO UNITED TEACHERS' SACCO",
  fullName: "BUKONZO UNITED TEACHERS' COOPERATIVE SAVINGS AND CREDIT SOCIETY LIMITED",
  regNo: "9668 / RCS",
  poBox: "P.O. Box 142, Kasese, Uganda",
  phones: ["0779-021565", "0788-566925", "0782-147266"],
  email: "bukonzounitedteacherssacco@gmail.com",
};

export default function ThermalReceipt({
  size = "80mm",
  orderNumber,
  date,
  items,
  total,
  totalLabel = "TOTAL DEPOSIT",
  footerLines = [],
  teeth = 18,
}: ThermalReceiptProps) {
  const toothPx = size === "58mm" ? 6 : 8;
  const clipPath = buildZigzag(teeth, toothPx);
  const width = size === "58mm" ? 218 : 302; // px ≈ mm at 96dpi

  const paper: React.CSSProperties = {
    width: size,
    clipPath,
    WebkitClipPath: clipPath,
    paddingTop: toothPx + 20,
    paddingBottom: toothPx + 20,
    paddingLeft: 18,
    paddingRight: 18,
    background: "#f5f5f0",
    color: "#111",
    boxSizing: "border-box",
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  };

  return (
    <>
      <div
        className={`${pixelFont.className}`}
        style={{
          background: "#f0f0f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "16px 8px 24px",
        }}
      >
        {/* Print button — hidden when printing */}
        <button
          onClick={() => window.print()}
          className="no-print"
          style={{
            background: "#111",
            color: "#f5f5f0",
            border: "none",
            borderRadius: 4,
            padding: "10px 32px",
            fontSize: 13,
            fontFamily: "inherit",
            letterSpacing: 2,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          PRINT RECEIPT
        </button>

        {/* Receipt paper */}
        <div style={paper}>
          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: size === "58mm" ? 11 : 13, lineHeight: 1.4, marginBottom: 8 }}>
              {SACCO.fullName}
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.7 }}>REG. NO: {SACCO.regNo}</div>
            <div style={{ fontSize: 10, lineHeight: 1.7 }}>{SACCO.poBox}</div>
            <div style={{ fontSize: 10, lineHeight: 1.7 }}>
              {SACCO.phones.join(" | ")}
            </div>
            <div style={{ fontSize: 9, lineHeight: 1.7, wordBreak: "break-all" }}>{SACCO.email}</div>
          </div>

          <Dash />

          {/* ── Order / Ref ── */}
          <Row label="RECEIPT NO" value={`#${orderNumber}`} bold />
          <div style={{ fontSize: 10, marginTop: 4, marginBottom: 10 }}>{date}</div>

          <Dash />

          {/* ── Line items ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
            {items.map((item, i) => (
              <Row
                key={i}
                label={item.label}
                value={item.value}
                bold={item.bold}
                large={item.large}
              />
            ))}
          </div>

          <Dash />

          {/* ── Total ── */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: size === "58mm" ? 14 : 17,
              marginTop: 6,
              marginBottom: 6,
            }}
          >
            <span>{totalLabel}</span>
            <span>{total}</span>
          </div>

          <Dash />

          {/* ── Signature line ── */}
          <div style={{ marginTop: 18, marginBottom: 18 }}>
            <div style={{ borderBottom: "1px solid #111", marginBottom: 4 }} />
            <div style={{ fontSize: 9, textAlign: "center" }}>AUTHORISED SIGNATURE</div>
          </div>

          {/* ── Footer ── */}
          <div style={{ fontSize: 9, textAlign: "center", lineHeight: 1.7, opacity: 0.8 }}>
            {footerLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            <div style={{ marginTop: 6 }}>
              *** THANK YOU FOR SAVING WITH US ***
            </div>
            <div>Generated: {new Date().toLocaleString("en-GB")}</div>
          </div>
        </div>
      </div>

      {/* ── Print media styles ── */}
      <style>{`
        @media print {
          @page { size: ${size} auto; margin: 0; }
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
        }
      `}</style>
    </>
  );
}

function Dash() {
  return (
    <div
      style={{
        borderBottom: "2px dashed #111",
        margin: "8px 0",
      }}
    />
  );
}

function Row({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  const fs = large ? 15 : 11;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: fs,
        fontWeight: bold ? 700 : 400,
        gap: 8,
      }}
    >
      <span style={{ flex: "0 0 auto" }}>{label}</span>
      <span style={{ textAlign: "right", flex: "1 1 auto" }}>{value}</span>
    </div>
  );
}
