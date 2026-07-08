import { db } from "@/prisma/db";

export const ACCOUNTING_SYNC_KEY = "ACCOUNTING_SYNC_STATE";

export interface AccountingSyncState {
  version: string;
  updatedAt: string | null;
  description: string | null;
}

async function upsertAccountingSyncRow(description?: string) {
  const now = new Date();

  return db.systemConfiguration.upsert({
    where: { key: ACCOUNTING_SYNC_KEY },
    update: {
      value: now.toISOString(),
      category: "ACCOUNTING",
      dataType: "TIMESTAMP",
      description: description || "Last accounting write refresh stamp",
    },
    create: {
      key: ACCOUNTING_SYNC_KEY,
      value: now.toISOString(),
      category: "ACCOUNTING",
      dataType: "TIMESTAMP",
      description: description || "Last accounting write refresh stamp",
    },
  });
}

export async function getAccountingSyncState(): Promise<AccountingSyncState> {
  try {
    const row = await db.systemConfiguration.findUnique({
      where: { key: ACCOUNTING_SYNC_KEY },
    });

    if (!row) {
      const created = await upsertAccountingSyncRow("Initial accounting sync state");
      return {
        version: created.updatedAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        description: created.description ?? null,
      };
    }

    return {
      version: row.value || row.updatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      description: row.description ?? null,
    };
  } catch (error) {
    console.warn("Failed to read accounting sync state:", error);
    const now = new Date().toISOString();
    return {
      version: now,
      updatedAt: now,
      description: "Fallback accounting sync state",
    };
  }
}

/**
 * Records a timestamp noting that an accounting-related activity occurred.
 * NOTE: This does NOT perform any actual sync, reconciliation, or validation.
 * It only writes a timestamp to systemConfiguration for informational purposes.
 * @deprecated Use only for auditing when accounting events happen. Does not sync anything.
 */
export async function bumpAccountingSyncState(description?: string): Promise<AccountingSyncState> {
  try {
    const row = await upsertAccountingSyncRow(description);
    return {
      version: row.value || row.updatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      description: row.description ?? null,
    };
  } catch (error) {
    console.warn("Failed to bump accounting sync state:", error);
    const now = new Date().toISOString();
    return {
      version: now,
      updatedAt: now,
      description: description || "Fallback accounting sync bump",
    };
  }
}
