import { ensureAssetStructure } from "@/lib/services/asset-structure";
import { ensureLiabilityStructure } from "@/lib/services/liability-structure";
import { ensureEquityStructure } from "@/lib/services/equity-structure";
import { ensureIncomeStructure } from "@/lib/services/income-structure";
import { ensureExpenditureStructure } from "@/lib/services/expenditure-structure";

export async function ensureCoreChartOfAccountsStructure() {
  const [assets, liabilities, equity, income, expenditure] = await Promise.all([
    ensureAssetStructure(),
    ensureLiabilityStructure(),
    ensureEquityStructure(),
    ensureIncomeStructure(),
    ensureExpenditureStructure(),
  ]);

  return {
    assets,
    liabilities,
    equity,
    income,
    expenditure,
  };
}
