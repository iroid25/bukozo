import { CASH_AT_HAND_CODE } from "@/lib/services/asset-structure";
import { AssetStatus, AssetType, Prisma } from "@prisma/client";

type DisposalMethod = "SALE" | "DONATION" | "WRITE_OFF";

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function normalizeDisposalMethod(value: unknown): DisposalMethod {
  const method = String(value || "WRITE_OFF").trim().toUpperCase();
  if (method === "SALE" || method === "DONATION" || method === "WRITE_OFF") {
    return method;
  }
  return "WRITE_OFF";
}

async function ensureChartAccount(
  tx: Prisma.TransactionClient,
  options: {
    accountName: string;
    ledgerType: "INCOME" | "EXPENDITURES";
    parentCode: string;
    description: string;
  },
) {
  const existing = await tx.chartOfAccount.findFirst({
    where: {
      accountName: options.accountName,
      ledgerType: options.ledgerType,
    },
  });

  if (existing) return existing;

  const parentAccount = await tx.chartOfAccount.findUnique({
    where: { accountCode: options.parentCode },
  });

  if (!parentAccount) {
    throw new Error(`Parent account ${options.parentCode} not found.`);
  }

  const lastChild = await tx.chartOfAccount.findFirst({
    where: { parentId: parentAccount.id },
    orderBy: { accountCode: "desc" },
  });

  let nextCode = parentAccount.level === 1 ? 100 : 1;
  if (lastChild) {
    const lastNumber = parseInt(lastChild.accountCode, 10);
    nextCode = Number.isNaN(lastNumber)
      ? nextCode
      : lastNumber + (parentAccount.level === 1 ? 100 : 1);
  } else {
    const base = parseInt(parentAccount.accountCode, 10);
    nextCode = Number.isNaN(base)
      ? nextCode
      : base + (parentAccount.level === 1 ? 100 : 1);
  }

  const accountCode = String(nextCode).padStart(6, "0");

  return tx.chartOfAccount.create({
    data: {
      accountCode,
      fullCode: accountCode,
      accountName: options.accountName,
      ledgerType: options.ledgerType,
      debitCredit: options.ledgerType === "INCOME" ? "CR" : "DR",
      isActive: true,
      isSystem: true,
      level: parentAccount.level + 1,
      parentId: parentAccount.id,
      description: options.description,
      category: parentAccount.category || parentAccount.accountName,
    },
  });
}

async function resolveProceedsAccount(
  tx: Prisma.TransactionClient,
  accountId?: string | null,
) {
  if (accountId) {
    const account = await tx.chartOfAccount.findFirst({
      where: {
        id: accountId,
        ledgerType: "ASSETS",
        isActive: true,
      },
    });

    if (!account) {
      throw new Error("The selected proceeds account was not found or is inactive.");
    }

    return account;
  }

  const fallback = await tx.chartOfAccount.findFirst({
    where: {
      ledgerType: "ASSETS",
      isActive: true,
      OR: [
        { accountCode: CASH_AT_HAND_CODE },
        { accountCode: "102001" },
        { accountCode: "102002" },
        { accountName: { contains: "cash", mode: "insensitive" } },
        { accountName: { contains: "bank", mode: "insensitive" } },
        { accountName: { contains: "vault", mode: "insensitive" } },
      ],
    },
    orderBy: { accountCode: "asc" },
  });

  if (!fallback) {
    throw new Error(
      "A cash or bank asset account is required to record sale proceeds. Provide proceedsAccountId.",
    );
  }

  return fallback;
}

export async function finalizeFixedAssetDisposal(
  tx: Prisma.TransactionClient,
  options: {
    assetId: string;
    userId: string;
    disposalMethod?: unknown;
    disposalAmount?: unknown;
    disposalDate?: unknown;
    disposalNotes?: unknown;
    proceedsAccountId?: unknown;
  },
) {
  const method = normalizeDisposalMethod(options.disposalMethod);
  const disposalAmount = roundMoney(Number(options.disposalAmount || 0));
  const disposalNotes =
    typeof options.disposalNotes === "string" ? options.disposalNotes.trim() : null;
  const disposalDate = options.disposalDate
    ? new Date(String(options.disposalDate))
    : new Date();
  const proceedsAccountId =
    typeof options.proceedsAccountId === "string" &&
    options.proceedsAccountId.trim()
      ? options.proceedsAccountId.trim()
      : null;

  if (Number.isNaN(disposalDate.getTime())) {
    throw new Error("Invalid disposalDate");
  }

  if (method === "SALE" && disposalAmount <= 0) {
    throw new Error("Sale disposal requires a disposalAmount greater than zero.");
  }

  const asset = await tx.fixedAsset.findUnique({
    where: { id: options.assetId },
    include: {
      account: true,
      accumulatedDepreciationAccount: true,
      depreciationExpenseAccount: true,
      branch: true,
      responsiblePerson: { select: { name: true } },
    },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  if (asset.assetType !== AssetType.FIXED) {
    throw new Error("Only fixed assets can be disposed.");
  }

  if (asset.status !== AssetStatus.ACTIVE) {
    throw new Error("Asset has already been disposed or written off.");
  }

  const assetAccount =
    asset.account ||
    (await tx.chartOfAccount.findFirst({
      where: {
        ledgerType: "ASSETS",
        isActive: true,
        accountName: {
          contains: `(${asset.assetCode})`,
          mode: "insensitive",
        },
      },
    }));

  if (!assetAccount) {
    throw new Error(
      "Linked asset account not found. The asset cannot be disposed until its ledger account is linked.",
    );
  }

  const grossAssetBalance = roundMoney(
    Math.abs(Number(assetAccount.balance || 0)) > 0.009
      ? Number(assetAccount.balance)
      : Number(asset.purchasePrice) * Number(asset.quantity || 1),
  );

  const contraBalance = asset.accumulatedDepreciationAccount
    ? Math.abs(Number(asset.accumulatedDepreciationAccount.balance || 0))
    : roundMoney(
        Math.max(
          Number(asset.accumulatedDepreciation || 0),
          grossAssetBalance - Number(asset.currentValue || grossAssetBalance),
        ),
      );

  const bookValue = roundMoney(Math.max(grossAssetBalance - contraBalance, 0));

  const lines: Array<{
    accountId: string;
    debitAmount: number;
    creditAmount: number;
    description: string;
  }> = [];

  if (contraBalance > 0 && asset.accumulatedDepreciationAccount) {
    lines.push({
      accountId: asset.accumulatedDepreciationAccount.id,
      debitAmount: contraBalance,
      creditAmount: 0,
      description: `Clear accumulated depreciation for ${asset.assetName} (${asset.assetCode})`,
    });
  }

  lines.push({
    accountId: assetAccount.id,
    debitAmount: 0,
    creditAmount: grossAssetBalance,
    description: `Remove disposed asset ${asset.assetName} (${asset.assetCode}) from the books`,
  });

  let proceedsAccount = null as Awaited<ReturnType<typeof resolveProceedsAccount>> | null;
  if (method === "SALE" && disposalAmount > 0) {
    proceedsAccount = await resolveProceedsAccount(tx, proceedsAccountId);
    lines.push({
      accountId: proceedsAccount.id,
      debitAmount: disposalAmount,
      creditAmount: 0,
      description: `Record sale proceeds for disposed asset ${asset.assetName} (${asset.assetCode})`,
    });
  }

  const gainLoss = roundMoney(disposalAmount - bookValue);
  if (Math.abs(gainLoss) > 0.009) {
    if (gainLoss > 0) {
      const gainAccount = await ensureChartAccount(tx, {
        accountName: "Gain on Asset Disposal",
        ledgerType: "INCOME",
        parentCode: "400000",
        description: "System-generated gain on asset disposal account",
      });

      lines.push({
        accountId: gainAccount.id,
        debitAmount: 0,
        creditAmount: gainLoss,
        description: `Gain on disposal of ${asset.assetName} (${asset.assetCode})`,
      });
    } else {
      const lossAccount = await ensureChartAccount(tx, {
        accountName: "Loss on Asset Disposal",
        ledgerType: "EXPENDITURES",
        parentCode: "500000",
        description: "System-generated loss on asset disposal account",
      });

      lines.push({
        accountId: lossAccount.id,
        debitAmount: Math.abs(gainLoss),
        creditAmount: 0,
        description: `Loss on disposal of ${asset.assetName} (${asset.assetCode})`,
      });
    }
  }

  const totalDebits = roundMoney(
    lines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0),
  );
  const totalCredits = roundMoney(
    lines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0),
  );

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(
      `Disposal journal does not balance. Debits ${totalDebits.toFixed(2)} vs credits ${totalCredits.toFixed(2)}.`,
    );
  }

  const entryNumber = `JE-ASSET-DISPOSAL-${asset.assetCode}-${Date.now()}`;

  for (const line of lines) {
    await tx.journalEntry.create({
      data: {
        entryNumber,
        entryDate: disposalDate,
        accountId: line.accountId,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        description: line.description,
        reference: asset.receiptNo || asset.invoiceNumber || asset.assetCode,
        branchId: asset.branchId || undefined,
        createdByUserId: options.userId,
      },
    });

    await tx.chartOfAccount.update({
      where: { id: line.accountId },
      data: {
        debitBalance: { increment: line.debitAmount },
        creditBalance: { increment: line.creditAmount },
        balance: { increment: line.debitAmount - line.creditAmount },
      },
    });
  }

  const nextStatus =
    method === "WRITE_OFF" || disposalAmount <= 0
      ? AssetStatus.WRITTEN_OFF
      : AssetStatus.DISPOSED;

  const updatedAsset = await tx.fixedAsset.update({
    where: { id: asset.id },
    data: {
      status: nextStatus,
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionReason: null,
      disposalDate,
      disposalAmount,
      disposalMethod: method,
      disposalNotes,
      currentValue: bookValue,
      accumulatedDepreciation: contraBalance,
    },
    include: {
      account: true,
      accumulatedDepreciationAccount: true,
      branch: true,
      responsiblePerson: { select: { name: true } },
    },
  });

  return {
    asset: updatedAsset,
    journalEntry: {
      entryNumber,
      totalDebits,
      totalCredits,
      gainLoss,
      bookValue,
      grossAssetBalance,
    },
  };
}
