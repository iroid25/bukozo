export const DORMANCY_REACTIVATION_MIN_BALANCE = 5000;
export const DORMANCY_REACTIVATION_PENALTY = 5000;

export function calculateAvailableBalance(balance: number, minBalance: number) {
  return Math.max(0, balance - minBalance);
}

export function shouldMarkAccountDormant(balance: number, minBalance: number) {
  return balance < minBalance;
}

export function generateDormancyReference(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
