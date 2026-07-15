# Relworx Mobile Money Integration — Implementation Guide

### For: Bukonzo United Teachers SACCO web app (NestJS + Prisma + PostgreSQL)

### Audience: AI coding agent (Claude Code / IDE assistant) implementing this end-to-end

---

## 0. Before you start — assumptions to verify against the real schema

This guide assumes field names that may not match the existing project exactly. **Before generating code, inspect the real `Member` and `Loan` Prisma models and adjust field names accordingly.** Flagged assumptions:

- `Member` has a `msisdn` (or `phoneNumber`) field, internationally formatted (`+2567XXXXXXXX`).
- `Member` has an `id` (string/cuid) primary key.
- `Loan` has an `id`, `memberId`, `outstandingPrincipal`, `outstandingInterest` (or equivalent), and a repayment allocation function already exists somewhere in the codebase (loan repayments should call into that, not reinvent principal/interest splitting here).
- Staff users have a `role` field with values including at least `TELLER` and `ADMIN` (adjust to match the existing RBAC enum).
- The Chart of Accounts / journal-entry posting layer already exposes a function like `ledgerService.postJournalEntry(entries: {accountId, debit, credit}[])` — this guide calls into it, it does not redesign it.
- **Decision needed from Iroid before staff/member withdrawal endpoints go live:** does a member-initiated withdrawal require staff approval before disbursement, or is it fully self-service? This guide implements the **safer default: member-initiated withdrawals require staff/teller approval**, staff-initiated withdrawals do not (staff is already the approver). Change `REQUIRE_APPROVAL_FOR_MEMBER_WITHDRAWAL` if this assumption is wrong.

---

## 1. Environment variables

Add to `.env` (confirm the missing ones don't already exist under different names):

```dotenv
RELWORX_API_KEY=
RELWORX_ACCOUNT_NO=
RELWORX_BASE_URL=https://payments.relworx.com/api
RELWORX_WEBHOOK_KEY=
RELWORX_WEBHOOK_URL=https://yourdomain.com/api/webhooks/relworx   # must match EXACTLY what is registered in the Relworx dashboard, including trailing slash or lack thereof
RELWORX_API_VERSION=application/vnd.relworx.v2
RELWORX_REQUEST_TIMEOUT_MS=15000
RELWORX_STATUS_POLL_AFTER_MS=180000   # 3 minutes — how long to wait before treating a PENDING tx as "check via polling"
```

**Error handling at this step:** on app bootstrap, validate all `RELWORX_*` env vars are present and throw a fast, descriptive startup error if any are missing (fail loud at boot, not on first transaction). Add this to whatever config validation module already exists (e.g. `ConfigModule` with Joi/Zod schema) — do not silently default to `undefined`.

---

## 2. Prisma schema — add the transaction model

```prisma
enum MomoTxType {
  DEPOSIT
  WITHDRAWAL
  LOAN_REPAYMENT
}

enum MomoTxStatus {
  INITIATED   // created locally, not yet sent to Relworx
  SUBMITTED   // sent to Relworx, awaiting webhook/poll
  SUCCESS
  FAILED
  EXPIRED     // no webhook or poll resolution within SLA
}

enum MomoChannel {
  SELF_SERVICE
  STAFF_ASSISTED
}

enum MomoApprovalStatus {
  NOT_REQUIRED
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

model MomoTransaction {
  id                  String              @id @default(cuid())
  type                MomoTxType
  channel             MomoChannel
  memberId            String
  member              Member              @relation(fields: [memberId], references: [id])
  loanId              String?
  msisdn              String
  amount              Decimal             @db.Decimal(18, 2)
  currency            String              @default("UGX")
  reference           String              @unique
  internalReference   String?             @unique
  provider            String?
  charge              Decimal?            @db.Decimal(18, 2)
  status              MomoTxStatus        @default(INITIATED)
  approvalStatus      MomoApprovalStatus  @default(NOT_REQUIRED)
  initiatedByUserId   String?             // null if member self-service
  approvedByUserId    String?
  failureReason       String?
  rawWebhookPayload   Json?
  ledgerEntryId       String?
  retryCount          Int                 @default(0)
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  completedAt         DateTime?

  @@index([status])
  @@index([memberId])
  @@index([reference])
}
```

Run:

```bash
npx prisma migrate dev --name add_momo_transactions
```

**Error handling:** if migration fails because `Member` model has a different id type or name, the agent must inspect `schema.prisma` first and adapt the `@relation` before running migrate — do not force it with `db push --force-reset`.

---

## 3. Reference generator utility

```typescript
// src/common/utils/reference-generator.ts
import { randomBytes } from "crypto";

export function generateMomoReference(prefix: "DEP" | "WDR" | "RPY"): string {
  const rand = randomBytes(6).toString("hex"); // 12 chars
  const ref = `${prefix}-${Date.now().toString(36)}-${rand}`;
  // Relworx requires 8–36 chars — this pattern is well within bounds
  if (ref.length < 8 || ref.length > 36) {
    throw new Error("Generated reference out of Relworx bounds — fix pattern");
  }
  return ref;
}
```

---

## 4. Core RelworxService — all HTTP calls, centralized error handling

```typescript
// src/relworx/relworx.service.ts
import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";

interface RelworxErrorShape {
  success: false;
  message: string;
}

export class RelworxApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly relworxMessage: string,
    public readonly raw?: unknown,
  ) {
    super(`Relworx API error (${httpStatus}): ${relworxMessage}`);
  }
}

@Injectable()
export class RelworxService {
  private readonly logger = new Logger(RelworxService.name);
  private readonly baseUrl = process.env.RELWORX_BASE_URL;
  private readonly accountNo = process.env.RELWORX_ACCOUNT_NO;
  private readonly apiKey = process.env.RELWORX_API_KEY;
  private readonly apiVersion =
    process.env.RELWORX_API_VERSION ?? "application/vnd.relworx.v2";
  private readonly timeoutMs = Number(
    process.env.RELWORX_REQUEST_TIMEOUT_MS ?? 15000,
  );

  private headers() {
    return {
      "Content-Type": "application/json",
      Accept: this.apiVersion,
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /** Wraps fetch with timeout + uniform error mapping. Never throws raw fetch errors upward. */
  private async call(path: string, init: RequestInit): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: this.headers(),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        this.logger.error(`Relworx request timed out: ${path}`);
        throw new RelworxApiError(504, "Request to Relworx timed out");
      }
      this.logger.error(`Relworx network error: ${err.message}`);
      throw new RelworxApiError(503, "Could not reach Relworx — network error");
    } finally {
      clearTimeout(timeout);
    }

    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new RelworxApiError(
        res.status,
        "Relworx returned a non-JSON response",
      );
    }

    if (!res.ok || body?.success === false) {
      // Map Relworx's documented codes: 400, 401, 403, 404, 422, 500, 503
      const message =
        (body as RelworxErrorShape)?.message ?? `HTTP ${res.status}`;
      this.logger.warn(
        `Relworx rejected request [${res.status}] ${path}: ${message}`,
      );
      throw new RelworxApiError(res.status, message, body);
    }

    return body;
  }

  async requestPayment(params: {
    reference: string;
    msisdn: string;
    amount: number;
    description: string;
  }) {
    return this.call("/mobile-money/request-payment", {
      method: "POST",
      body: JSON.stringify({
        account_no: this.accountNo,
        reference: params.reference,
        msisdn: params.msisdn,
        currency: "UGX",
        amount: params.amount,
        description: params.description,
      }),
    });
  }

  async sendPayment(params: {
    reference: string;
    msisdn: string;
    amount: number;
    description: string;
  }) {
    return this.call("/mobile-money/send-payment", {
      method: "POST",
      body: JSON.stringify({
        account_no: this.accountNo,
        reference: params.reference,
        msisdn: params.msisdn,
        currency: "UGX",
        amount: params.amount,
        description: params.description,
      }),
    });
  }

  async validateMsisdn(msisdn: string) {
    return this.call("/mobile-money/validate", {
      method: "POST",
      body: JSON.stringify({ msisdn }),
    });
  }

  async checkWalletBalance(currency = "UGX") {
    return this.call(
      `/mobile-money/check-wallet-balance?account_no=${this.accountNo}&currency=${currency}`,
      { method: "GET" },
    );
  }

  async checkRequestStatus(internalReference: string) {
    return this.call(
      `/mobile-money/check-request-status?internal_reference=${internalReference}&account_no=${this.accountNo}`,
      { method: "GET" },
    );
  }
}
```

**Error handling notes for the agent:**

- Every Relworx HTTP status (400/401/403/404/422/500/503) is normalized into `RelworxApiError` so callers don't branch on raw HTTP codes.
- Network failure and timeout are treated as `503`-equivalent — retryable — not as a transaction failure.
- Never let a raw `fetch` exception bubble to a controller — the controller must always be able to return a clean JSON error to the frontend.

---

## 5. Rate limiting `request-payment` (5 requests / 10 min / msisdn)

Relworx enforces this server-side, but pre-empt it locally to give a good UX and avoid burning the quota on retries.

```typescript
// src/relworx/momo-rate-limiter.service.ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class MomoRateLimiterService {
  private attempts = new Map<string, number[]>(); // msisdn -> timestamps

  canRequest(msisdn: string): boolean {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const timestamps = (this.attempts.get(msisdn) ?? []).filter(
      (t) => now - t < windowMs,
    );
    this.attempts.set(msisdn, timestamps);
    return timestamps.length < 5;
  }

  record(msisdn: string) {
    const timestamps = this.attempts.get(msisdn) ?? [];
    timestamps.push(Date.now());
    this.attempts.set(msisdn, timestamps);
  }
}
```

> Note for the agent: this in-memory map is fine for a single-instance deployment. If the app runs multiple instances/PM2 clusters, back this with Redis instead (`INCR` + `EXPIRE`) so limits are shared across processes.

**Error handling:** if `canRequest()` returns false, return HTTP 429 with a clear message ("Too many attempts for this number, please wait a few minutes") **before** calling Relworx at all — don't waste an API call you know will be rejected.

---

## 6. DTOs with validation

```typescript
// src/relworx/dto/deposit.dto.ts
import {
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class InitiateDepositDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class InitiateWithdrawalDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class InitiateLoanRepaymentDto {
  @IsString()
  loanId: string;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class StaffInitiateTransactionDto {
  @IsString()
  memberId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  loanId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

Ensure `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` is globally registered (check `main.ts` — likely already is, given existing project conventions). **Error handling:** invalid payloads should fail at the pipe level with 400, before touching the service layer at all.

---

## 7. Core transaction orchestration service

This is the single place both member and staff controllers call into — **do not duplicate transaction-creation logic between the two controllers.**

```typescript
// src/relworx/momo-transaction.service.ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RelworxService, RelworxApiError } from "./relworx.service";
import { MomoRateLimiterService } from "./momo-rate-limiter.service";
import { generateMomoReference } from "../common/utils/reference-generator";
import {
  MomoTxType,
  MomoChannel,
  MomoApprovalStatus,
  MomoTxStatus,
} from "@prisma/client";

const REQUIRE_APPROVAL_FOR_MEMBER_WITHDRAWAL = true; // see assumption note in section 0

@Injectable()
export class MomoTransactionService {
  private readonly logger = new Logger(MomoTransactionService.name);

  constructor(
    private prisma: PrismaService,
    private relworx: RelworxService,
    private rateLimiter: MomoRateLimiterService,
  ) {}

  async initiateDeposit(
    memberId: string,
    amount: number,
    description: string | undefined,
    channel: MomoChannel,
    initiatedByUserId?: string,
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (!member.msisdn)
      throw new BadRequestException(
        "Member has no registered mobile money number",
      );

    return this.submitCollection({
      type: MomoTxType.DEPOSIT,
      memberId,
      msisdn: member.msisdn,
      amount,
      description: description ?? `Deposit for ${member.id}`,
      channel,
      initiatedByUserId,
    });
  }

  async initiateLoanRepayment(
    memberId: string,
    loanId: string,
    amount: number,
    channel: MomoChannel,
    initiatedByUserId?: string,
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException("Member not found");

    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException("Loan not found");
    if (loan.memberId !== memberId)
      throw new ForbiddenException("Loan does not belong to this member");
    // Adjust field name below to match real Loan model (outstandingPrincipal + outstandingInterest, or similar)
    // if (amount > loan.outstandingBalance) throw new BadRequestException('Amount exceeds outstanding loan balance');

    return this.submitCollection({
      type: MomoTxType.LOAN_REPAYMENT,
      memberId,
      loanId,
      msisdn: member.msisdn,
      amount,
      description: `Loan repayment for loan ${loanId}`,
      channel,
      initiatedByUserId,
    });
  }

  async initiateWithdrawal(
    memberId: string,
    amount: number,
    description: string | undefined,
    channel: MomoChannel,
    initiatedByUserId?: string,
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException("Member not found");
    if (!member.msisdn)
      throw new BadRequestException(
        "Member has no registered mobile money number",
      );

    // TODO agent: check member's savings/share balance covers this amount BEFORE creating the tx row.
    // e.g. const balance = await this.ledgerService.getMemberSavingsBalance(memberId);
    // if (amount > balance) throw new BadRequestException('Insufficient savings balance');

    const needsApproval =
      channel === MomoChannel.SELF_SERVICE &&
      REQUIRE_APPROVAL_FOR_MEMBER_WITHDRAWAL;

    const reference = generateMomoReference("WDR");
    const tx = await this.prisma.momoTransaction.create({
      data: {
        type: MomoTxType.WITHDRAWAL,
        channel,
        memberId,
        msisdn: member.msisdn,
        amount,
        reference,
        status: MomoTxStatus.INITIATED,
        approvalStatus: needsApproval
          ? MomoApprovalStatus.PENDING_APPROVAL
          : MomoApprovalStatus.NOT_REQUIRED,
        initiatedByUserId,
      },
    });

    if (needsApproval) {
      this.logger.log(`Withdrawal ${tx.id} created, awaiting staff approval`);
      return tx; // do NOT call Relworx yet — staff must approve first
    }

    return this.dispatchWithdrawalToRelworx(tx.id);
  }

  /** Staff calls this to approve a pending member withdrawal, which then dispatches it. */
  async approveWithdrawal(transactionId: string, approverUserId: string) {
    const tx = await this.prisma.momoTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    if (tx.approvalStatus !== MomoApprovalStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Transaction is not pending approval (current: ${tx.approvalStatus})`,
      );
    }

    await this.prisma.momoTransaction.update({
      where: { id: transactionId },
      data: {
        approvalStatus: MomoApprovalStatus.APPROVED,
        approvedByUserId: approverUserId,
      },
    });

    return this.dispatchWithdrawalToRelworx(transactionId);
  }

  async rejectWithdrawal(
    transactionId: string,
    approverUserId: string,
    reason: string,
  ) {
    const tx = await this.prisma.momoTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException("Transaction not found");
    return this.prisma.momoTransaction.update({
      where: { id: transactionId },
      data: {
        approvalStatus: MomoApprovalStatus.REJECTED,
        status: MomoTxStatus.FAILED,
        approvedByUserId: approverUserId,
        failureReason: reason,
      },
    });
  }

  private async dispatchWithdrawalToRelworx(transactionId: string) {
    const tx = await this.prisma.momoTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException("Transaction not found");

    // Check float BEFORE calling send-payment
    try {
      const balance = await this.relworx.checkWalletBalance(tx.currency);
      if (Number(balance.balance) < Number(tx.amount)) {
        await this.prisma.momoTransaction.update({
          where: { id: tx.id },
          data: {
            status: MomoTxStatus.FAILED,
            failureReason: "Insufficient Relworx wallet float",
          },
        });
        throw new BadRequestException(
          "SACCO mobile money float is insufficient for this withdrawal. Contact an administrator to top up.",
        );
      }
    } catch (err) {
      if (err instanceof RelworxApiError) {
        // Could not even check balance — do not attempt disbursement blind
        await this.prisma.momoTransaction.update({
          where: { id: tx.id },
          data: {
            status: MomoTxStatus.FAILED,
            failureReason: `Balance check failed: ${err.relworxMessage}`,
          },
        });
        throw new BadRequestException(
          "Could not verify mobile money float right now. Try again shortly.",
        );
      }
      throw err;
    }

    try {
      const response = await this.relworx.sendPayment({
        reference: tx.reference,
        msisdn: tx.msisdn,
        amount: Number(tx.amount),
        description: `Withdrawal for member ${tx.memberId}`,
      });

      return this.prisma.momoTransaction.update({
        where: { id: tx.id },
        data: {
          status: MomoTxStatus.SUBMITTED,
          internalReference: response.internal_reference,
        },
      });
    } catch (err) {
      return this.handleSubmissionFailure(tx.id, err);
    }
  }

  private async submitCollection(args: {
    type: MomoTxType;
    memberId: string;
    loanId?: string;
    msisdn: string;
    amount: number;
    description: string;
    channel: MomoChannel;
    initiatedByUserId?: string;
  }) {
    if (!this.rateLimiter.canRequest(args.msisdn)) {
      throw new BadRequestException(
        "Too many attempts for this number. Please wait a few minutes and try again.",
      );
    }

    const reference = generateMomoReference(
      args.type === MomoTxType.DEPOSIT ? "DEP" : "RPY",
    );

    const tx = await this.prisma.momoTransaction.create({
      data: {
        type: args.type,
        channel: args.channel,
        memberId: args.memberId,
        loanId: args.loanId,
        msisdn: args.msisdn,
        amount: args.amount,
        reference,
        status: MomoTxStatus.INITIATED,
        initiatedByUserId: args.initiatedByUserId,
      },
    });

    this.rateLimiter.record(args.msisdn);

    try {
      const response = await this.relworx.requestPayment({
        reference,
        msisdn: args.msisdn,
        amount: args.amount,
        description: args.description,
      });

      return this.prisma.momoTransaction.update({
        where: { id: tx.id },
        data: {
          status: MomoTxStatus.SUBMITTED,
          internalReference: response.internal_reference,
        },
      });
    } catch (err) {
      return this.handleSubmissionFailure(tx.id, err);
    }
  }

  private async handleSubmissionFailure(transactionId: string, err: unknown) {
    const message =
      err instanceof RelworxApiError
        ? err.relworxMessage
        : "Unknown error contacting Relworx";
    this.logger.error(
      `Momo transaction ${transactionId} failed to submit: ${message}`,
    );

    await this.prisma.momoTransaction.update({
      where: { id: transactionId },
      data: { status: MomoTxStatus.FAILED, failureReason: message },
    });

    if (err instanceof RelworxApiError) {
      if (err.httpStatus === 503 || err.httpStatus === 504) {
        throw new BadRequestException(
          "Mobile money service is temporarily unavailable. Please try again shortly.",
        );
      }
      if (err.httpStatus === 422) {
        throw new BadRequestException(
          `Transaction details were rejected: ${message}`,
        );
      }
      if (err.httpStatus === 401 || err.httpStatus === 403) {
        // This is a config/credentials problem, not a user error — log loudly, don't expose internals to the user
        this.logger.error(
          "Relworx auth failure — check RELWORX_API_KEY / RELWORX_ACCOUNT_NO",
        );
        throw new BadRequestException(
          "Mobile money service is currently misconfigured. Support has been notified.",
        );
      }
    }
    throw new BadRequestException(
      "Could not process this mobile money request. Please try again.",
    );
  }
}
```

**Error handling notes:**

- Every branch that can fail writes a `FAILED` status with a `failureReason` to the DB _before_ throwing back to the controller — never leave a row stuck in `INITIATED` because of an uncaught exception.
- 401/403 from Relworx is treated as a system misconfiguration, not a user-facing validation error — it should also trigger an alert (Slack/email) in production, not just a log line.
- Withdrawal float check happens strictly before `send-payment` is called — never attempt disbursement blind.

---

## 8. Webhook signature verification + idempotent reconciliation

```typescript
// src/relworx/relworx-signature.util.ts
import * as crypto from "crypto";

export function verifyRelworxSignature(
  webhookKey: string,
  callbackUrl: string,
  signatureHeader: string,
  params: {
    status: string;
    customer_reference: string;
    internal_reference: string;
  },
): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const { t: timestamp, v: signature } = parts;
  if (!timestamp || !signature) return false;

  const sortedKeys = Object.keys(params).sort() as (keyof typeof params)[];
  let signedData = callbackUrl + timestamp;
  for (const key of sortedKeys) signedData += key + params[key];

  const expected = crypto
    .createHmac("sha256", webhookKey)
    .update(signedData)
    .digest("hex");

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false; // length mismatch etc.
  }
}
```

```typescript
// src/relworx/relworx-webhook.controller.ts
import { Controller, Post, Req, Res, Logger, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { verifyRelworxSignature } from "./relworx-signature.util";
import { MomoWebhookReconcilerService } from "./momo-webhook-reconciler.service";

@Controller("webhooks/relworx")
export class RelworxWebhookController {
  private readonly logger = new Logger(RelworxWebhookController.name);

  constructor(private reconciler: MomoWebhookReconcilerService) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response) {
    try {
      const signatureHeader = req.headers["relworx-signature"] as string;
      const { status, customer_reference, internal_reference } = req.body ?? {};

      if (!status || !customer_reference || !internal_reference) {
        this.logger.warn("Webhook payload missing required fields");
        // Still return 200 — a malformed payload retried 10x won't fix itself.
        // Log it for manual investigation instead.
        return res.status(HttpStatus.OK).send("ignored: malformed payload");
      }

      const valid = verifyRelworxSignature(
        process.env.RELWORX_WEBHOOK_KEY!,
        process.env.RELWORX_WEBHOOK_URL!,
        signatureHeader,
        { status, customer_reference, internal_reference },
      );

      if (!valid) {
        this.logger.warn(
          `Invalid webhook signature for reference ${customer_reference}`,
        );
        // Return 401, not 200 — an invalid signature should NOT be silently accepted,
        // but also should not be retried blindly if it's a genuine forgery attempt.
        return res.status(HttpStatus.UNAUTHORIZED).send("invalid signature");
      }

      await this.reconciler.reconcile(req.body);
      return res.status(HttpStatus.OK).send("OK");
    } catch (err) {
      this.logger.error(
        `Webhook processing error: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Return 500 deliberately here (NOT 200) so Relworx retries — this is an
      // infra failure (e.g. DB down), not a bad payload, and we want the retry.
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send("internal error");
    }
  }
}
```

```typescript
// src/relworx/momo-webhook-reconciler.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MomoTxStatus, MomoTxType } from "@prisma/client";
import { LedgerService } from "../ledger/ledger.service"; // adjust import to real path

@Injectable()
export class MomoWebhookReconcilerService {
  private readonly logger = new Logger(MomoWebhookReconcilerService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  async reconcile(payload: {
    status: string;
    customer_reference: string;
    internal_reference: string;
    msisdn?: string;
    amount?: number;
    currency?: string;
    provider?: string;
    charge?: number;
  }) {
    const tx = await this.prisma.momoTransaction.findUnique({
      where: { reference: payload.customer_reference },
    });

    if (!tx) {
      this.logger.error(
        `Webhook for unknown reference: ${payload.customer_reference} — no matching local transaction`,
      );
      return; // nothing to reconcile against; do not throw (would trigger pointless retries)
    }

    // IDEMPOTENCY GUARD — critical, since Relworx retries webhooks up to 10x
    if (
      tx.status === MomoTxStatus.SUCCESS ||
      tx.status === MomoTxStatus.FAILED
    ) {
      this.logger.log(
        `Transaction ${tx.id} already resolved (${tx.status}) — ignoring duplicate webhook`,
      );
      return;
    }

    const isSuccess = payload.status === "success";

    if (!isSuccess) {
      await this.prisma.momoTransaction.update({
        where: { id: tx.id },
        data: {
          status: MomoTxStatus.FAILED,
          failureReason: `Relworx reported status: ${payload.status}`,
          rawWebhookPayload: payload as any,
          completedAt: new Date(),
        },
      });
      this.logger.log(`Transaction ${tx.id} marked FAILED per webhook`);
      return;
    }

    // SUCCESS — post to the ledger inside a DB transaction so status + journal entry commit atomically
    await this.prisma.$transaction(async (prismaTx) => {
      let ledgerEntryId: string;

      try {
        if (tx.type === MomoTxType.DEPOSIT) {
          ledgerEntryId = await this.ledger.postDeposit(prismaTx, {
            memberId: tx.memberId,
            amount: Number(tx.amount),
            charge: payload.charge ?? 0,
            sourceRef: tx.id,
          });
        } else if (tx.type === MomoTxType.WITHDRAWAL) {
          ledgerEntryId = await this.ledger.postWithdrawal(prismaTx, {
            memberId: tx.memberId,
            amount: Number(tx.amount),
            charge: payload.charge ?? 0,
            sourceRef: tx.id,
          });
        } else if (tx.type === MomoTxType.LOAN_REPAYMENT) {
          ledgerEntryId = await this.ledger.postLoanRepayment(prismaTx, {
            loanId: tx.loanId!,
            memberId: tx.memberId,
            amount: Number(tx.amount),
            charge: payload.charge ?? 0,
            sourceRef: tx.id,
          });
        } else {
          throw new Error(`Unhandled transaction type: ${tx.type}`);
        }
      } catch (ledgerErr) {
        // Ledger posting failed AFTER Relworx confirmed money moved — this is the
        // most dangerous failure mode: money moved but books didn't update.
        // Do NOT mark as FAILED (money genuinely arrived). Leave status as SUBMITTED
        // and flag loudly for manual reconciliation.
        this.logger.error(
          `CRITICAL: Relworx confirmed success for tx ${tx.id} but ledger posting failed: ${(ledgerErr as Error).message}. Manual reconciliation required.`,
        );
        throw ledgerErr; // rolls back the prisma.$transaction — status update below won't apply either
      }

      await prismaTx.momoTransaction.update({
        where: { id: tx.id },
        data: {
          status: MomoTxStatus.SUCCESS,
          provider: payload.provider,
          charge: payload.charge,
          ledgerEntryId,
          rawWebhookPayload: payload as any,
          completedAt: new Date(),
        },
      });
    });

    this.logger.log(
      `Transaction ${tx.id} confirmed SUCCESS and posted to ledger`,
    );
  }
}
```

**This is the most important error-handling decision in the whole system:** if the ledger post fails _after_ Relworx confirms success, the transaction must stay in `SUBMITTED` (not `FAILED`, not `SUCCESS`) and trigger an alert — because real money already moved but your books don't reflect it yet. Never auto-resolve this ambiguity; it needs a human to reconcile.

---

## 9. Reconciliation cron — catches missed/delayed webhooks

```typescript
// src/relworx/momo-reconciliation.cron.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RelworxService } from "./relworx.service";
import { MomoWebhookReconcilerService } from "./momo-webhook-reconciler.service";
import { MomoTxStatus } from "@prisma/client";

@Injectable()
export class MomoReconciliationCron {
  private readonly logger = new Logger(MomoReconciliationCron.name);
  private readonly pollAfterMs = Number(
    process.env.RELWORX_STATUS_POLL_AFTER_MS ?? 180000,
  );

  constructor(
    private prisma: PrismaService,
    private relworx: RelworxService,
    private reconciler: MomoWebhookReconcilerService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async pollStalePending() {
    const cutoff = new Date(Date.now() - this.pollAfterMs);

    const stale = await this.prisma.momoTransaction.findMany({
      where: {
        status: MomoTxStatus.SUBMITTED,
        updatedAt: { lt: cutoff },
        internalReference: { not: null },
      },
      take: 50, // batch, don't hammer the API
    });

    for (const tx of stale) {
      try {
        const result = await this.relworx.checkRequestStatus(
          tx.internalReference!,
        );
        if (result.status === "success" || result.status === "failed") {
          await this.reconciler.reconcile({
            status: result.status,
            customer_reference: tx.reference,
            internal_reference: tx.internalReference!,
            msisdn: result.msisdn,
            amount: result.amount,
            currency: result.currency,
            provider: result.provider,
            charge: result.charge,
          });
        }
        // if still pending, leave it — will be picked up again next cycle
      } catch (err) {
        this.logger.warn(
          `Reconciliation poll failed for tx ${tx.id}: ${(err as Error).message}`,
        );
        // do not mark as failed just because the status check itself errored — retry next cycle
      }
    }

    // Anything pending for over, say, 24h with no resolution — flag as EXPIRED for manual review
    const veryStale = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.momoTransaction.updateMany({
      where: { status: MomoTxStatus.SUBMITTED, updatedAt: { lt: veryStale } },
      data: { status: MomoTxStatus.EXPIRED },
    });
  }
}
```

Requires `@nestjs/schedule` — confirm it's already installed (`npm ls @nestjs/schedule`); if not, `npm install @nestjs/schedule` and register `ScheduleModule.forRoot()` in the root module.

---

## 10. Controllers — member vs staff, with role guards

```typescript
// src/relworx/member-momo.controller.ts
import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard"; // adjust to real guard path
import { MomoTransactionService } from "./momo-transaction.service";
import {
  InitiateDepositDto,
  InitiateLoanRepaymentDto,
  InitiateWithdrawalDto,
} from "./dto/deposit.dto";
import { MomoChannel } from "@prisma/client";

@UseGuards(JwtAuthGuard)
@Controller("member/momo")
export class MemberMomoController {
  constructor(private momo: MomoTransactionService) {}

  @Post("deposit")
  deposit(@Req() req, @Body() dto: InitiateDepositDto) {
    const memberId = req.user.memberId; // adjust to real JWT payload shape
    return this.momo.initiateDeposit(
      memberId,
      dto.amount,
      dto.description,
      MomoChannel.SELF_SERVICE,
    );
  }

  @Post("repay-loan")
  repayLoan(@Req() req, @Body() dto: InitiateLoanRepaymentDto) {
    const memberId = req.user.memberId;
    return this.momo.initiateLoanRepayment(
      memberId,
      dto.loanId,
      dto.amount,
      MomoChannel.SELF_SERVICE,
    );
  }

  @Post("withdraw")
  withdraw(@Req() req, @Body() dto: InitiateWithdrawalDto) {
    const memberId = req.user.memberId;
    return this.momo.initiateWithdrawal(
      memberId,
      dto.amount,
      dto.description,
      MomoChannel.SELF_SERVICE,
    );
  }
}
```

```typescript
// src/relworx/staff-momo.controller.ts
import { Controller, Post, Body, UseGuards, Req, Param } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard"; // adjust to real guard
import { Roles } from "../auth/roles.decorator";
import { MomoTransactionService } from "./momo-transaction.service";
import { StaffInitiateTransactionDto } from "./dto/deposit.dto";
import { MomoChannel } from "@prisma/client";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("staff/momo")
export class StaffMomoController {
  constructor(private momo: MomoTransactionService) {}

  @Roles("TELLER", "ADMIN")
  @Post("deposit")
  deposit(@Req() req, @Body() dto: StaffInitiateTransactionDto) {
    return this.momo.initiateDeposit(
      dto.memberId,
      dto.amount,
      dto.description,
      MomoChannel.STAFF_ASSISTED,
      req.user.id,
    );
  }

  @Roles("TELLER", "ADMIN")
  @Post("repay-loan")
  repayLoan(@Req() req, @Body() dto: StaffInitiateTransactionDto) {
    return this.momo.initiateLoanRepayment(
      dto.memberId,
      dto.loanId!,
      dto.amount,
      MomoChannel.STAFF_ASSISTED,
      req.user.id,
    );
  }

  @Roles("TELLER", "ADMIN") // consider restricting withdrawal disbursement to ADMIN only if that matches SACCO policy
  @Post("withdraw")
  withdraw(@Req() req, @Body() dto: StaffInitiateTransactionDto) {
    return this.momo.initiateWithdrawal(
      dto.memberId,
      dto.amount,
      dto.description,
      MomoChannel.STAFF_ASSISTED,
      req.user.id,
    );
  }

  @Roles("ADMIN", "TELLER")
  @Post("withdrawals/:id/approve")
  approve(@Req() req, @Param("id") id: string) {
    return this.momo.approveWithdrawal(id, req.user.id);
  }

  @Roles("ADMIN", "TELLER")
  @Post("withdrawals/:id/reject")
  reject(@Req() req, @Param("id") id: string, @Body("reason") reason: string) {
    return this.momo.rejectWithdrawal(id, req.user.id, reason);
  }
}
```

---

## 11. Global exception filter (so every error above returns clean, consistent JSON)

```typescript
// src/common/filters/relworx-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { RelworxApiError } from "../../relworx/relworx.service";

@Catch()
export class RelworxExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RelworxExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).json(exception.getResponse());
    }

    if (exception instanceof RelworxApiError) {
      this.logger.error(`Unhandled RelworxApiError: ${exception.message}`);
      return res.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: HttpStatus.BAD_GATEWAY,
        message: "Mobile money provider error. Please try again shortly.",
      });
    }

    this.logger.error(
      `Unhandled exception: ${(exception as Error)?.message}`,
      (exception as Error)?.stack,
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Something went wrong. Please try again.",
    });
  }
}
```

Apply only to the `relworx` module's controllers (`@UseFilters(RelworxExceptionFilter)` on the controller class), rather than globally, unless the project doesn't already have a global filter — check `main.ts` first.

---

## 12. Module wiring

```typescript
// src/relworx/relworx.module.ts
import { Module } from "@nestjs/common";
import { RelworxService } from "./relworx.service";
import { MomoTransactionService } from "./momo-transaction.service";
import { MomoRateLimiterService } from "./momo-rate-limiter.service";
import { MomoWebhookReconcilerService } from "./momo-webhook-reconciler.service";
import { MomoReconciliationCron } from "./momo-reconciliation.cron";
import { MemberMomoController } from "./member-momo.controller";
import { StaffMomoController } from "./staff-momo.controller";
import { RelworxWebhookController } from "./relworx-webhook.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { LedgerModule } from "../ledger/ledger.module"; // adjust to real module

@Module({
  imports: [PrismaModule, LedgerModule],
  controllers: [
    MemberMomoController,
    StaffMomoController,
    RelworxWebhookController,
  ],
  providers: [
    RelworxService,
    MomoTransactionService,
    MomoRateLimiterService,
    MomoWebhookReconcilerService,
    MomoReconciliationCron,
  ],
})
export class RelworxModule {}
```

Import `RelworxModule` into `AppModule`.

**One critical infra note:** the webhook route (`/webhooks/relworx`) must be reachable **without** the global JWT guard applied (it's Relworx calling you, not an authenticated user) — verify it's excluded from any global `APP_GUARD` in `main.ts` or `app.module.ts`, and that raw body parsing isn't broken by any global middleware if signature verification ever needs the raw body instead of parsed JSON.

---

## 13. Testing checklist (sandbox, before going live)

1. **Deposit — member self-service:** initiate small deposit (e.g. UGX 500), confirm `SUBMITTED` status locally, confirm webhook arrives, confirm status flips to `SUCCESS`, confirm ledger entry created.
2. **Deposit — staff-assisted:** same as above, but through staff endpoint, confirm `initiatedByUserId` populated.
3. **Loan repayment:** confirm loan balance actually decreases after webhook success — this is the one most likely to have a schema mismatch (adjust `ledger.postLoanRepayment` to real repayment allocation logic).
4. **Withdrawal — staff:** confirm float check runs, confirm `send-payment` only fires after balance check passes.
5. **Withdrawal — member self-service with approval required:** confirm it sits in `PENDING_APPROVAL` and does **not** call Relworx until a staff member approves.
6. **Rate limit:** fire 6 deposit requests for the same msisdn within 10 minutes, confirm the 6th is rejected locally with a 429 before hitting Relworx.
7. **Webhook signature tampering:** manually send a POST to the webhook endpoint with a bad signature, confirm 401 and no ledger changes.
8. **Duplicate webhook:** manually resend the same webhook payload twice, confirm the ledger entry is only posted once (idempotency guard).
9. **Simulate Relworx 503:** temporarily point `RELWORX_BASE_URL` at an invalid host, confirm the transaction fails gracefully with a clean user-facing message and a `FAILED` DB row — not a 500 crash.
10. **Reconciliation cron:** create a `SUBMITTED` row with `updatedAt` manually set 5+ minutes in the past, run the cron manually, confirm it polls and resolves it.

---

## 14. Go-live checklist

- [ ] `RELWORX_WEBHOOK_URL` registered in Relworx dashboard matches env var **exactly** (protocol, domain, path, trailing slash)
- [ ] Webhook endpoint reachable publicly (not behind VPN/firewall) and excluded from global auth guard
- [ ] All `RELWORX_*` env vars set in production, validated at boot
- [ ] Alerting wired for: 401/403 from Relworx (config issue), ledger-post-after-webhook-success failures (critical), transactions stuck `EXPIRED`
- [ ] Rate limiter backed by Redis if running more than one app instance
- [ ] Staff roles for withdrawal approval confirmed against actual SACCO policy (who can approve, single or dual approval for large amounts — consider a threshold-based dual-approval rule if the SACCO requires it for big withdrawals)
- [ ] Reconciliation cron confirmed running in production (not just registered locally in dev)
