import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const officers = await prisma.user.findMany({
        where: { role: 'LOANOFFICER' },
        select: { id: true, name: true, role: true }
    });
    console.log("Loan Officers found:", officers.length);
    console.log(officers);
}
main().finally(() => prisma.$disconnect());
