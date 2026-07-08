export type FeeTier = {
  min: number;
  max: number;
  fee: number;
};

export type AgentFeeTier = {
  min: number;
  max: number;
  charge: number;
  saccoShare: number;
  agentShare: number;
};

// 1. Mobile Money Transfer Charges (SACCO Account -> Mobile Money)
export const MOBILE_MONEY_TRANSFER_FEES: FeeTier[] = [
  { min: 500, max: 10_000, fee: 300 },
  { min: 10_001, max: 30_000, fee: 400 },
  { min: 30_001, max: 50_000, fee: 500 },
  { min: 50_001, max: 100_000, fee: 600 },
  { min: 100_001, max: 250_000, fee: 800 },
  { min: 250_001, max: 500_000, fee: 1_100 },
  { min: 500_001, max: 750_000, fee: 1_400 },
  { min: 750_001, max: 1_000_000, fee: 1_700 },
];

export const MOBILE_MONEY_SERVICE_FEE = 500;

// 3a. Agent Withdrawal Charges (Withdraw from SACCO Agent)
export const AGENT_WITHDRAWAL_FEES: AgentFeeTier[] = [
  { min: 5_000, max: 250_000, charge: 500, saccoShare: 200, agentShare: 300 },
  { min: 250_001, max: 500_000, charge: 700, saccoShare: 300, agentShare: 400 },
  { min: 500_001, max: 750_000, charge: 1_000, saccoShare: 400, agentShare: 600 },
  { min: 750_001, max: 1_000_000, charge: 1_300, saccoShare: 500, agentShare: 800 },
  { min: 1_000_001, max: 1_500_000, charge: 1_500, saccoShare: 600, agentShare: 900 },
  { min: 1_500_001, max: 2_000_000, charge: 2_000, saccoShare: 800, agentShare: 1_200 },
  { min: 2_000_001, max: 2_500_000, charge: 2_500, saccoShare: 1_000, agentShare: 1_500 },
  { min: 2_500_001, max: 3_000_000, charge: 3_000, saccoShare: 1_300, agentShare: 1_700 },
];

// 3b. Agent Deposit Charges (Deposit to individual account via Agent)
export const AGENT_DEPOSIT_FEES: AgentFeeTier[] = [
  { min: 5_000, max: 250_000, charge: 500, saccoShare: 200, agentShare: 300 },
  { min: 250_001, max: 500_000, charge: 700, saccoShare: 300, agentShare: 400 },
  { min: 500_001, max: 750_000, charge: 1_000, saccoShare: 400, agentShare: 600 },
  { min: 750_001, max: 1_000_000, charge: 1_300, saccoShare: 500, agentShare: 800 },
  { min: 1_000_001, max: 1_500_000, charge: 1_500, saccoShare: 500, agentShare: 1_000 },
  { min: 1_500_001, max: 2_000_000, charge: 2_000, saccoShare: 700, agentShare: 1_300 },
  { min: 2_000_001, max: 2_500_000, charge: 2_500, saccoShare: 1_000, agentShare: 1_500 },
  { min: 2_500_001, max: 3_000_000, charge: 3_000, saccoShare: 1_300, agentShare: 1_700 },
];

// 5. School Fees Commission
export const SCHOOL_FEES_COMMISSION = {
  total: 1_500,
  saccoShare: 1_000,
  agentShare: 500,
};

export function calculateMobileMoneyFee(amount: number): number {
  const tier = MOBILE_MONEY_TRANSFER_FEES.find(
    (t) => amount >= t.min && amount <= t.max
  );
  return tier ? tier.fee : 0;
}

export function calculateAgentWithdrawalFee(amount: number): AgentFeeTier | null {
  return (
    AGENT_WITHDRAWAL_FEES.find((t) => amount >= t.min && amount <= t.max) ||
    null
  );
}

export function calculateAgentDepositFee(amount: number): AgentFeeTier | null {
  return (
    AGENT_DEPOSIT_FEES.find((t) => amount >= t.min && amount <= t.max) ||
    null
  );
}

export type WithdrawalFeeTier = {
  min: number;
  max: number | null;
  fee: number;
};

export const MEMBER_WITHDRAWAL_FEES: WithdrawalFeeTier[] = [
  { min: 5000, max: 1000000, fee: 300 },
  { min: 1000001, max: 2000000, fee: 500 },
  { min: 2000001, max: 4000000, fee: 1000 },
  { min: 4000001, max: 4999999, fee: 1500 },
  { min: 5000000, max: null, fee: 2000 },
];

export const INSTITUTION_WITHDRAWAL_FEES: WithdrawalFeeTier[] = [
  { min: 5000, max: 2000000, fee: 1000 },
  { min: 2000001, max: 5000000, fee: 2000 },
  { min: 5000001, max: null, fee: 3000 },
];

export type PenaltyTier = {
  minDays: number;
  maxDays: number;
  penaltyRate: number;
};

export const DEFAULT_PENALTY_TIERS: PenaltyTier[] = [
  { minDays: 1, maxDays: 30, penaltyRate: 0.06 },
  { minDays: 31, maxDays: 60, penaltyRate: 0.09 },
  { minDays: 61, maxDays: 90, penaltyRate: 0.12 },
  { minDays: 91, maxDays: 120, penaltyRate: 0.15 },
  { minDays: 121, maxDays: 150, penaltyRate: 0.18 },
  { minDays: 151, maxDays: 360, penaltyRate: 0.21 },
  { minDays: 361, maxDays: 9999, penaltyRate: 0.24 },
];

export const SAVINGS_POLICIES = {
  annualInterestRate: 10,
  monthlyInterestRate: 0.833,
  fixedPeriods: [3, 6, 9, 12],
};
