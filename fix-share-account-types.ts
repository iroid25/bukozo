import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const parent = await db.chartOfAccount.findUnique({ where: { accountCode: "304000" } });
  if (!parent) throw new Error("304000 not found");

  const ledgerData = [
    { code: "300501", name: "Affiliate Members Shares" },
    { code: "300502", name: "Ordinary Members Shares" },
    { code: "300503", name: "Associate Members Shares" },
  ];
  const ledgerIds: Record<string, string> = {};

  for (const ld of ledgerData) {
    const existing = await db.chartOfAccount.findUnique({ where: { accountCode: ld.code } });
    if (existing) {
      console.log("Ledger exists:", ld.code, existing.accountName);
      ledgerIds[ld.code] = existing.id;
    } else {
      const created = await db.chartOfAccount.create({
        data: {
          accountCode: ld.code,
          accountName: ld.name,
          fullCode: ld.code,
          ledgerType: "EQUITY",
          level: 3,
          parentId: parent.id,
          isActive: true,
          balance: 0,
        },
      });
      console.log("Created ledger:", ld.code, ld.name);
      ledgerIds[ld.code] = created.id;
    }
  }

  const mapping: Record<string, string> = {
    "cmpfhk6s90008v3qc2q58ivjd": "300501", // Affiliate Shares
    "cmpfhk6m50007v3qcbcn7b8po": "300502", // Ordinary Shares
    "cmpfhk6ye0009v3qcknxzth5i": "300503", // Associate Shares
  };

  for (const [typeId, ledgerCode] of Object.entries(mapping)) {
    const updated = await db.accountType.update({
      where: { id: typeId },
      data: { ledgerAccountId: ledgerIds[ledgerCode] },
    });
    console.log("Linked", updated.name, "->", ledgerCode);
  }

  await db.$disconnect();
}
main().catch(console.error);
