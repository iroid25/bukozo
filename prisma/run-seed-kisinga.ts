import { db } from "./db.ts";
import { seedKisingaInstitutions } from "./seed-kisinga-institutions.ts";

async function main() {
  const branch = await db.branch.findFirst({
    where: { name: "Main Branch - Kisinga" },
    select: { id: true, name: true },
  });

  if (!branch) {
    throw new Error("Main Branch - Kisinga not found");
  }

  const result = await seedKisingaInstitutions(db, branch.id);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
