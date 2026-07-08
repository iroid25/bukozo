import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { loanMaintenanceTargets } from "./loan-maintenance.ts";
import { db } from "../prisma/db.ts";

const CONFIRM_FLAG = process.argv.includes("--confirm");
const CONFIRM_ENV = process.env.CONFIRM_LOAN_PURGE === "YES";

async function createBackupSnapshot() {
  const backupDir = join(process.cwd(), "progress", "loan-backups");
  await mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(backupDir, `loan-purge-backup-${timestamp}.json`);

  const payload: Record<string, any> = {
    createdAt: new Date().toISOString(),
    counts: {},
    data: {},
  };

  for (const target of loanMaintenanceTargets) {
    const rows = await target.snapshot();
    payload.counts[target.label] = rows.length;
    payload.data[target.label] = rows;
    console.log(`[backup] ${target.label}: ${rows.length} rows`);
  }

  await writeFile(backupFile, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Pre-purge backup written to ${backupFile}`);
}

async function main() {
  if (!CONFIRM_FLAG && !CONFIRM_ENV) {
    throw new Error(
      "Refusing to purge loans. Re-run with --confirm or CONFIRM_LOAN_PURGE=YES after backup verification.",
    );
  }

  console.log("Starting loan-domain purge...");
  await createBackupSnapshot();

  const summary: Record<string, number> = {};
  for (const target of loanMaintenanceTargets) {
    const result = await target.purge();
    summary[target.label] = result.count;
    console.log(`[purge] ${target.label}: deleted ${result.count} rows`);
  }

  console.log("Loan-domain purge complete.");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error("Loan purge failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
