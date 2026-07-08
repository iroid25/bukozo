const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Check if AccountHold model exists on client instance or export
// Actually, types are not exported in JS runtime, but the model property is on the instance.
console.log('AccountHold property on client:', !!prisma.accountHold);
