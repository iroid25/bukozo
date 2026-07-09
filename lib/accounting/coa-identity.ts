export const HIDDEN_COA_CODES = new Set(["102003", "301004", "401006", "401300"]);

const LEGACY_CODE_ALIASES: Record<string, string[]> = {
  "107000": ["102003"],
  "401005": ["401300"],
  "401300": ["401005"],
};

type ChartOfAccountClient = {
  chartOfAccount: {
    findFirst(args: any): Promise<any>;
  };
};

export function isHiddenCoaCode(code?: string | null) {
  return !!code && HIDDEN_COA_CODES.has(code);
}

export function getAccountCodeCandidates(code: string) {
  const aliases = LEGACY_CODE_ALIASES[code] || [];
  if (code === "401300") {
    return ["401005", "401300", ...aliases.filter((alias) => alias !== "401005")];
  }
  if (code === "401005") {
    return ["401005", ...aliases.filter((alias) => alias !== "401005")];
  }
  return [code, ...aliases];
}

export async function findActiveAccountByCodes(
  client: ChartOfAccountClient,
  codes: string[],
) {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];

  for (const code of uniqueCodes) {
    const account = await client.chartOfAccount.findFirst({
      where: { accountCode: code, isActive: true },
    });

    if (account) {
      return account;
    }
  }

  return null;
}
