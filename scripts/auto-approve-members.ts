import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Starting auto-approval of existing members...");
  
  try {
    const result = await db.member.updateMany({
      where: {
        approvalStatus: "PENDING"
      },
      data: {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        // We can't easily set approvedByUserId to a system user without knowing one, 
        // but for migration purposes, leaving it null or setting it later is fine.
        // Or we could set it to the first admin found, but let's keep it simple.
      }
    });

    console.log(`Successfully approved ${result.count} existing members.`);
  } catch (error) {
    console.error("Error approving members:", error);
  } finally {
    await db.$disconnect();
  }
}

main();
