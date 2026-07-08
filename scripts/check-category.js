const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.budgetCategory.findUnique({ where: { code: '40100' } })
  .then(c => console.log(JSON.stringify(c, null, 2)))
  .finally(() => p.$disconnect());
