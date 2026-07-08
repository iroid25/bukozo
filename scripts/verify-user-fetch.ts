
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Attempting to connect to database...');
  try {
    const count = await prisma.user.count();
    console.log(`Successfully connected! Found ${count} users.`);
    
    console.log('Attempting to fetch one user with all relations...');
    const user = await prisma.user.findFirst({
      include: {
        branch: true,
        member: true,
        // Fetching just a few relations to see if it works
        accountHoldsLifted: { select: { id: true } },
        AccountTransaction: { select: { id: true } },
      }
    });
    
    if (user) {
      console.log('Successfully fetched user:', user.name);
    } else {
      console.log('No users found, but query succeeded.');
    }
  } catch (error) {
    console.error('Error connecting or querying:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
