import * as crypto from "crypto";

export type RelworxSignatureCheck =
  | { result: "valid" }
  | { result: "invalid"; reason: string }
  | { result: "skipped"; reason: string };

/**
 * Verifies the `relworx-signature` webhook header (format: `t=<timestamp>,v=<signature>`).
 *
 * Fails OPEN (returns "skipped", not "invalid") when RELWORX_WEBHOOK_KEY or
 * RELWORX_WEBHOOK_URL isn't configured yet, so an incomplete .env doesn't silently
 * start rejecting every real webhook. Once both are set, mismatches are rejected.
 */
export function verifyRelworxWebhookSignature(
  signatureHeader: string | null,
  params: {
    status: string;
    customer_reference: string;
    internal_reference: string;
  },
): RelworxSignatureCheck {
  const webhookKey = process.env.RELWORX_WEBHOOK_KEY;
  const callbackUrl = process.env.RELWORX_WEBHOOK_URL;

  if (!webhookKey || !callbackUrl) {
    return {
      result: "skipped",
      reason:
        "RELWORX_WEBHOOK_KEY or RELWORX_WEBHOOK_URL not configured — signature verification skipped",
    };
  }

  if (!signatureHeader) {
    return { result: "invalid", reason: "Missing relworx-signature header" };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const { t: timestamp, v: signature } = parts;
  if (!timestamp || !signature) {
    return { result: "invalid", reason: "Malformed relworx-signature header" };
  }

  const sortedKeys = Object.keys(params).sort() as (keyof typeof params)[];
  let signedData = callbackUrl + timestamp;
  for (const key of sortedKeys) signedData += key + params[key];

  const expected = crypto
    .createHmac("sha256", webhookKey)
    .update(signedData)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) {
      return { result: "invalid", reason: "Signature length mismatch" };
    }
    const matches = crypto.timingSafeEqual(expectedBuf, signatureBuf);
    return matches
      ? { result: "valid" }
      : { result: "invalid", reason: "Signature does not match" };
  } catch {
    return { result: "invalid", reason: "Signature comparison failed" };
  }
}
