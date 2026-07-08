import { AccountLedgerType } from "@prisma/client";

export type LedgerTypeLike = AccountLedgerType | string;

type BalanceCarrier = {
  ledgerType: LedgerTypeLike;
  debitBalance: number;
  creditBalance: number;
};

type PostingAmounts = {
  debitAmount?: number;
  creditAmount?: number;
};

const DEBIT_NORMAL_LEDGER_TYPES = new Set<LedgerTypeLike>([
  "ASSETS",
  "EXPENDITURES",
]);

export function isDebitNormalBalance(ledgerType: LedgerTypeLike) {
  return DEBIT_NORMAL_LEDGER_TYPES.has(ledgerType);
}

export function calculateAccountBalance(
  ledgerType: LedgerTypeLike,
  debitBalance: number,
  creditBalance: number,
) {
  return isDebitNormalBalance(ledgerType)
    ? debitBalance - creditBalance
    : creditBalance - debitBalance;
}

export function getAccountDisplayBalance(account: BalanceCarrier) {
  return calculateAccountBalance(
    account.ledgerType,
    Number(account.debitBalance || 0),
    Number(account.creditBalance || 0),
  );
}

export function buildAccountBalanceUpdate(
  account: BalanceCarrier,
  posting: PostingAmounts,
) {
  const debitAmount = Number(posting.debitAmount || 0);
  const creditAmount = Number(posting.creditAmount || 0);

  const balanceDelta = isDebitNormalBalance(account.ledgerType)
    ? debitAmount - creditAmount
    : creditAmount - debitAmount;

  return {
    ...(debitAmount > 0 ? { debitBalance: { increment: debitAmount } } : {}),
    ...(creditAmount > 0 ? { creditBalance: { increment: creditAmount } } : {}),
    ...(balanceDelta !== 0 ? { balance: { increment: balanceDelta } } : {}),
  };
}
