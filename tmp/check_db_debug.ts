
import { db } from "./prisma/db";

async function main() {
  try {
    const memberCount = await db.member.count();
    console.log("Member Count:", memberCount);
    const members = await db.member.findMany({ take: 5 });
    console.log("First 5 members:", JSON.stringify(members, null, 2));
    
    const users = await db.user.findMany({ take: 5 });
    console.log("Users count:", await db.user.count());
    console.log("First 5 users:", JSON.stringify(users, null, 2));

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
