
import { db } from "./prisma/db";

async function main() {
  console.log("Checking for SACCO Reserve vault...");
  
  const existingReserve = await db.vault.findFirst({
    where: {
      branchId: null,
      isActive: true,
    }
  });

  if (existingReserve) {
    console.log("SACCO Reserve already exists:", existingReserve.name);
    return;
  }

  console.log("SACCO Reserve not found. Creating one...");

  // Find a custodian (e.g., Admin)
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  
  if (!admin) {
      console.error("No Admin found to be custodian.");
      // proceed anyway without custodian or handle error
  }

  const newReserve = await db.vault.create({
    data: {
      name: "SACCO Main Reserve",
      branchId: null, // Critical: this makes it the HQ reserve
      balance: 1000000000, // 1 Billion start
      physicalCash: 1000000000,
      location: "Head Office - Strongroom",
      custodianUserId: admin ? admin.id : undefined,
      isActive: true,
    }
  });

  console.log("Created SACCO Reserve:", newReserve);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
