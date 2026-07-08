import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
console.log("PRISMA INIT: connectionString present?", !!connectionString);

const pool =
  globalThis.prismaPool ||
  (connectionString
    ? new Pool({
        connectionString,
      })
    : undefined);

if (pool && process.env.NODE_ENV !== "production") {
  globalThis.prismaPool = pool;
}

const adapter = pool ? new PrismaPg(pool) : undefined;
console.log("PRISMA INIT: adapter created?", !!adapter);

export const db =
  globalThis.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"], // remove "query" - too verbose with pooler
    transactionOptions: {
      maxWait: 10000,
      timeout: 15000,
    },
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;

if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await db.$disconnect();
    await pool?.end();
  });
}
