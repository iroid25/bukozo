import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { loanMaintenanceTargets } from "./loan-maintenance.ts";
import { db } from "../prisma/db.ts";

async function main() {
  const backupDir = join(process.cwd(), "progress", "loan-backups");
  await mkdir(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = join(backupDir, `loan-backup-${timestamp}.json`);

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
  console.log(`Backup written to ${backupFile}`);
}

main()
  .catch((error) => {
    console.error("Loan backup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
