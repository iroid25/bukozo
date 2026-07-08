import { db } from "@/prisma/db";
import { ensureCoreChartOfAccountsStructure } from "@/lib/services/chart-of-accounts-bootstrap";
import { hydrateAccountsWithJournalBalances } from "@/lib/services/chartOfAccounts";

export type COANode = {
  id: string;
  accountCode: string;
  accountName: string;
  fullCode: string;
  level: number;
  ledgerType: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  isActive: boolean;
  children: COANode[];
};

const isDeprecatedLoanPortfolioAccount = (account: {
  accountCode: string;
  accountName: string;
}) =>
  account.accountCode === "102003" ||
  account.accountName.toLowerCase().includes("loan portfolio");

export async function getCOATree(branchId?: string) {
  await ensureCoreChartOfAccountsStructure();

  const accounts = await db.chartOfAccount.findMany({
    where: {
      isActive: true,
      NOT: {
        accountCode: "401006",
      },
    },
    orderBy: {
      accountCode: "asc",
    },
  });

  const visibleAccounts = accounts.filter(
    (account) => !isDeprecatedLoanPortfolioAccount(account),
  );

  const hydratedAccounts = branchId
    ? await hydrateAccountsWithJournalBalances(
        visibleAccounts.map((account) => ({
          id: account.id,
          ledgerType: account.ledgerType,
          balance: account.balance,
          debitBalance: account.debitBalance,
          creditBalance: account.creditBalance,
        })),
        branchId,
      )
    : accounts;
  const hydratedMap = new Map(hydratedAccounts.map((account) => [account.id, account]));

  const nodesMap = new Map<string, COANode>();
  const rootNodes: COANode[] = [];

  // Initialize all nodes
  visibleAccounts.forEach((acc) => {
    const hydrated = hydratedMap.get(acc.id);
    nodesMap.set(acc.id, {
      ...acc,
      balance: hydrated?.balance ?? acc.balance,
      debitBalance: hydrated?.debitBalance ?? acc.debitBalance,
      creditBalance: hydrated?.creditBalance ?? acc.creditBalance,
      children: [],
    } as COANode);
  });

  // Build the tree
  visibleAccounts.forEach((acc) => {
    const node = nodesMap.get(acc.id)!;
    if (acc.parentId && nodesMap.has(acc.parentId)) {
      const parent = nodesMap.get(acc.parentId)!;
      parent.children.push(node);
    } else {
        // Only allow the main pillars as root nodes to avoid clutter
        const pillarCodes = ['100000', '200000', '300000', '400000', '500000'];
        if (pillarCodes.includes(acc.accountCode)) {
            rootNodes.push(node);
        }
    }
  });

  const sortNodes = (nodes: COANode[]): COANode[] =>
    nodes
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));

  return sortNodes(rootNodes);
}
