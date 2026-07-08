
import { db } from "./prisma/db";

async function main() {
  const category = await db.incomeCategory.findFirst({
    where: { name: "Transaction Fees" }
  });
  console.log("Transaction Fees Category:", category);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
