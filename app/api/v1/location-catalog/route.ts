import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getAuthUser } from "@/config/useAuth";
import { db } from "@/prisma/db";
import {
  BUKONZO_EAST_CONSTITUENCIES,
  getBukonzoEastVillages,
} from "@/lib/location/bukonzo-east";

type DistrictRecord = {
  id: string;
  name: string;
};

type VillageRecord = {
  id: string;
  name: string;
  parishId: string;
};

type ParishSeedRecord = {
  id: string;
  name: string;
  subCountyId: string;
};

type ParishRecord = {
  id: string;
  name: string;
  subCountyId: string;
  villages?: VillageRecord[];
};

type SubCountyRecord = {
  id: string;
  name: string;
  constituencyId: string;
  parishes: ParishRecord[];
};

type ConstituencyRecord = {
  id: string;
  name: string;
  subCounties: SubCountyRecord[];
};

const escapeSqlValue = (value: string) => value.replace(/'/g, "''");

async function ensureLocationTables() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "District" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Constituency" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SubCounty" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "constituencyId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SubCounty_constituencyId_fkey"
        FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE CASCADE,
      CONSTRAINT "SubCounty_constituencyId_name_key" UNIQUE ("constituencyId", "name")
    );
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "SubCounty"
    ADD COLUMN IF NOT EXISTS "constituencyId" TEXT;
  `);

  // Older deployments created SubCounty with a plain UNIQUE("name") column
  // constraint before "constituencyId" existed. Sub-county/town-council
  // names legitimately repeat across different constituencies, so that
  // global constraint is wrong and rejects valid creates — drop it if a
  // prior migration left it behind.
  await db.$executeRawUnsafe(`
    ALTER TABLE "SubCounty" DROP CONSTRAINT IF EXISTS "SubCounty_name_key";
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "SubCounty_constituencyId_name_key"
    ON "SubCounty" ("constituencyId", "name");
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Parish" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "subCountyId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Parish_subCountyId_fkey"
        FOREIGN KEY ("subCountyId") REFERENCES "SubCounty"("id") ON DELETE CASCADE,
      CONSTRAINT "Parish_subCountyId_name_key" UNIQUE ("subCountyId", "name")
    );
  `);

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Village" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "parishId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Village_parishId_fkey"
        FOREIGN KEY ("parishId") REFERENCES "Parish"("id") ON DELETE CASCADE,
      CONSTRAINT "Village_parishId_name_key" UNIQUE ("parishId", "name")
    );
  `);
}

function createId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// Every INSERT below explicitly sets createdAt/updatedAt rather than
// relying on column defaults: on this database (and potentially other
// long-lived deployments), SubCounty and Parish were altered after initial
// creation and ended up with an updatedAt column that has NO default,
// causing a NOT NULL violation on every plain insert. Setting it explicitly
// works regardless of whether a given environment's column default is
// actually present.
async function upsertDistrict(name: string) {
  const [record] = await db.$queryRawUnsafe<DistrictRecord[]>(`
    INSERT INTO "District" ("id", "name", "createdAt", "updatedAt")
    VALUES ('${createId()}', '${escapeSqlValue(name)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("name")
    DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name";
  `);

  return record;
}

async function upsertConstituency(name: string) {
  const [record] = await db.$queryRawUnsafe<Pick<ConstituencyRecord, "id" | "name">[]>(`
    INSERT INTO "Constituency" ("id", "name", "createdAt", "updatedAt")
    VALUES ('${createId()}', '${escapeSqlValue(name)}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("name")
    DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name";
  `);

  return record;
}

async function upsertSubCounty(constituencyId: string, name: string) {
  const [record] = await db.$queryRawUnsafe<Pick<SubCountyRecord, "id" | "name" | "constituencyId">[]>(`
    INSERT INTO "SubCounty" ("id", "name", "constituencyId", "createdAt", "updatedAt")
    VALUES ('${createId()}', '${escapeSqlValue(name)}', '${constituencyId}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("constituencyId", "name")
    DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name", "constituencyId";
  `);

  return record;
}

async function upsertParish(subCountyId: string, name: string) {
  const [record] = await db.$queryRawUnsafe<ParishSeedRecord[]>(`
    INSERT INTO "Parish" ("id", "name", "subCountyId", "createdAt", "updatedAt")
    VALUES ('${createId()}', '${escapeSqlValue(name)}', '${subCountyId}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("subCountyId", "name")
    DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name", "subCountyId";
  `);

  return record;
}

async function upsertVillage(parishId: string, name: string) {
  const [record] = await db.$queryRawUnsafe<VillageRecord[]>(`
    INSERT INTO "Village" ("id", "name", "parishId", "createdAt", "updatedAt")
    VALUES ('${createId()}', '${escapeSqlValue(name)}', '${parishId}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("parishId", "name")
    DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "id", "name", "parishId";
  `);

  return record;
}

async function seedDefaults() {
  await upsertDistrict("Kasese");

  for (const constituency of BUKONZO_EAST_CONSTITUENCIES) {
    const constituencyRow = await upsertConstituency(constituency.name);

    for (const subCounty of constituency.subCounties) {
      const subCountyRow = await upsertSubCounty(constituencyRow.id, subCounty.name);

      for (const parish of subCounty.parishes) {
        const parishRow = await upsertParish(subCountyRow.id, parish);
        const villages = getBukonzoEastVillages(constituency.name, subCounty.name, parish);

        for (const village of villages) {
          await upsertVillage(parishRow.id, village);
        }
      }
    }
  }
}

async function loadCatalog(): Promise<ConstituencyRecord[]> {
  await ensureLocationTables();
  await seedDefaults();

  const constituencies = await db.$queryRawUnsafe<Array<Pick<ConstituencyRecord, "id" | "name">>>(`
    SELECT "id", "name"
    FROM "Constituency"
    ORDER BY "name" ASC;
  `);

  const subCounties = await db.$queryRawUnsafe<Array<Pick<SubCountyRecord, "id" | "name" | "constituencyId">>>(`
    SELECT "id", "name", "constituencyId"
    FROM "SubCounty"
    ORDER BY "name" ASC;
  `);

  const parishes = await db.$queryRawUnsafe<ParishSeedRecord[]>(`
    SELECT "id", "name", "subCountyId"
    FROM "Parish"
    ORDER BY "name" ASC;
  `);

  const villages = await db.$queryRawUnsafe<VillageRecord[]>(`
    SELECT "id", "name", "parishId"
    FROM "Village"
    ORDER BY "name" ASC;
  `);

  return constituencies.map((constituency) => ({
    ...constituency,
    subCounties: subCounties
      .filter((subCounty) => subCounty.constituencyId === constituency.id)
      .map((subCounty) => ({
        ...subCounty,
        parishes: parishes
          .filter((parish) => parish.subCountyId === subCounty.id)
          .map((parish) => ({
            ...parish,
            villages: villages.filter((village) => village.parishId === parish.id),
          })),
      })),
  }));
}

export async function GET() {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await loadCatalog();
    const districts = await db.$queryRawUnsafe<DistrictRecord[]>(`
      SELECT "id", "name"
      FROM "District"
      ORDER BY "name" ASC;
    `);
    return NextResponse.json({ success: true, data, districts });
  } catch (error) {
    console.error("Error loading location catalog:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load location catalog",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.DATA_ENTRANT,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You do not have permission to manage locations" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const kind = String(body?.kind || "").trim();
    const name = String(body?.name || "").trim();
    const districtName = String(body?.districtName || "").trim();
    const constituencyName = String(body?.constituencyName || "").trim();
    const subCountyName = String(body?.subCountyName || "").trim();
    const parishName = String(body?.parishName || "").trim();

    if (!kind) {
      return NextResponse.json({ error: "Location kind is required" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Location name is required" }, { status: 400 });
    }

    await ensureLocationTables();

    if (kind === "constituency") {
      const created = await upsertConstituency(name);
      return NextResponse.json({
        success: true,
        data: { ...created, subCounties: [] },
      });
    }

    if (kind === "district") {
      const created = await upsertDistrict(name);
      return NextResponse.json({
        success: true,
        data: created,
      });
    }

    if (kind === "subCounty") {
      if (!constituencyName) {
        return NextResponse.json(
          { error: "Constituency is required for sub county creation" },
          { status: 400 },
        );
      }

      const constituency = await upsertConstituency(constituencyName);
      const created = await upsertSubCounty(constituency.id, name);

      return NextResponse.json({
        success: true,
        data: { ...created, parishes: [] },
      });
    }

    if (kind === "parish") {
      if (!constituencyName) {
        return NextResponse.json(
          { error: "Constituency is required for parish creation" },
          { status: 400 },
        );
      }

      if (!subCountyName) {
        return NextResponse.json(
          { error: "Sub county is required for parish creation" },
          { status: 400 },
        );
      }

      const constituency = await upsertConstituency(constituencyName);
      const subCounty = await upsertSubCounty(constituency.id, subCountyName);
      const created = await upsertParish(subCounty.id, name);

      return NextResponse.json({
        success: true,
        data: { ...created, villages: [] },
      });
    }

    if (kind === "village") {
      if (!constituencyName) {
        return NextResponse.json(
          { error: "Constituency is required for village creation" },
          { status: 400 },
        );
      }

      if (!subCountyName) {
        return NextResponse.json(
          { error: "Sub county is required for village creation" },
          { status: 400 },
        );
      }

      if (!parishName) {
        return NextResponse.json(
          { error: "Parish is required for village creation" },
          { status: 400 },
        );
      }

      const constituency = await upsertConstituency(constituencyName);
      const subCounty = await upsertSubCounty(constituency.id, subCountyName);
      const parish = await upsertParish(subCounty.id, parishName);
      const created = await upsertVillage(parish.id, name);

      return NextResponse.json({
        success: true,
        data: created,
      });
    }

    return NextResponse.json({ error: "Invalid location kind" }, { status: 400 });
  } catch (error) {
    console.error("Error saving location catalog item:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save location catalog item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
