const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
async function main() {
  await p.$executeRawUnsafe('ALTER TABLE "Institution" ALTER COLUMN "institutionEmail" DROP NOT NULL');
  console.log("Done: institutionEmail is now nullable");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
