// lib/fees.ts

export type WithdrawalFeeTier = {
  /**
   * Upper bound for this tier (inclusive).
   * Use `null` for "and above" (the last, open-ended tier).
   */
  max: number | null;
  /** Flat fee (UGX) charged when the amount falls in this tier. */
  fee: number;
};

/**
 * Safely parse tiers from a JSON string stored in the DB.
 */
export function parseWithdrawalFeeTiers(
  raw: string | null | undefined
): WithdrawalFeeTier[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    if (!Array.isArray(parsed)) return [];

    const cleaned: WithdrawalFeeTier[] = parsed
      .map((t) => ({
        max:
          t?.max === null || t?.max === undefined
            ? null
            : Number.isFinite(Number(t.max))
              ? Number(t.max)
              : null,
        fee: Number.isFinite(Number(t?.fee)) ? Number(t.fee) : 0,
      }))
      .filter((t) => t.fee >= 0 && (t.max === null || t.max >= 0));

    // sort by max asc; keep the null (open) tier last if it exists
    const nulls = cleaned.filter((t) => t.max === null);
    const nonNulls = cleaned
      .filter((t) => t.max !== null)
      .sort((a, b) => a.max! - b.max!);

    const uniqueOpen =
      nulls.length > 0 ? [{ max: null, fee: nulls[nulls.length - 1].fee }] : [];

    return [...nonNulls, ...uniqueOpen];
  } catch {
    return [];
  }
}

/**
 * Stringify tiers for storage in the DB (as JSON).
 */
export function serializeWithdrawalFeeTiers(
  tiers: WithdrawalFeeTier[]
): string {
  // normalize before saving
  const parsed = parseWithdrawalFeeTiers(JSON.stringify(tiers));
  return JSON.stringify(parsed);
}

/**
 * Compute the withdrawal fee given an amount and account type config.
 * Priority:
 *  1) flatWithdrawalFee (if set)
 *  2) tiers (if defined)
 *  3) 0 (fallback)
 *
 * `accountType` only needs these two fields; pass your Prisma object or a pick.
 */
/**
 * Compute the withdrawal fee given an amount, account type config, and optional account overrides.
 *
 * Logic:
 *  1. Resolve Effective Configuration:
 *     - If Account has custom fee setting (flat/pct/tiers), use it.
 *     - Else use AccountType setting.
 *     - Note: A null/undefined custom field means "inherit from AccountType".
 *
 *  2. Calculate Base Fee:
 *     - If Effective Flat Fee is defined, use it.
 *     - Else check Effective Tiers.
 *
 *  3. Calculate Percentage Fee:
 *     - Add (Amount * Effective Percentage / 100).
 *
 * Result = Base Fee + Percentage Fee.
 */
export function calculateWithdrawalFee(
  amount: number,
  accountType: {
    flatWithdrawalFee?: number | null;
    withdrawalFeePercentage?: number | null;
    withdrawalFeeTiers?: string | null;
  },
  account?: {
    customFlatWithdrawalFee?: number | null;
    customWithdrawalFeePercentage?: number | null;
    customWithdrawalFeeTiers?: string | null;
  } | null,
  fallbackTiersJson?: string | null
): number {
  if (!Number.isFinite(Number(amount)) || amount <= 0) {
    return 0;
  }

  // 1. Resolve Effective Parameters
  // Flat Fee
  let flatFee: number | null = accountType.flatWithdrawalFee ?? null;
  if (account?.customFlatWithdrawalFee != null) {
    flatFee = account.customFlatWithdrawalFee;
  }

  // Percentage
  let pct: number | null = accountType.withdrawalFeePercentage ?? null;
  if (account?.customWithdrawalFeePercentage != null) {
    pct = account.customWithdrawalFeePercentage;
  }

  // Tiers
  let tiersJson: string | null = accountType.withdrawalFeeTiers ?? null;
  if (account?.customWithdrawalFeeTiers != null) {
    tiersJson = account.customWithdrawalFeeTiers;
  }

  let totalFee = 0;

  // 2. Base Fee (Flat vs Tiers)
  // If flat fee is explicitly set (even 0), it takes precedence over tiers.
  if (flatFee != null) {
    totalFee += Math.max(0, Number(flatFee));
  } else {
    // Try tiers
    let tiers = parseWithdrawalFeeTiers(tiersJson);
    
    // FALLBACK: If no tiers resolved from account/accountType, use global fallback tiers
    if (tiers.length === 0 && fallbackTiersJson) {
      tiers = parseWithdrawalFeeTiers(fallbackTiersJson);
    }

    if (tiers.length > 0) {
      const hit = tiers.find(
        (t) => t.max !== null && amount <= (t.max as number)
      );
      if (hit) {
        totalFee += Math.max(0, hit.fee);
      } else {
        // Open-ended tier
        const open = tiers.find((t) => t.max === null);
        if (open) {
          totalFee += Math.max(0, open.fee);
        }
      }
    }
  }

  // 3. Percentage Fee
  if (pct != null && pct > 0) {
    totalFee += (amount * pct) / 100;
  }

  return totalFee;
}
