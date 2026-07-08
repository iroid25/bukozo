import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { getAuthUser } from '@/config/useAuth';
import { ensureAssetStructure } from '@/lib/services/asset-structure';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureAssetStructure();

    const accounts = await db.chartOfAccount.findMany({
      where: {
        OR: [
          { accountCode: { startsWith: "101" } },
          { accountCode: { startsWith: "102" } },
        ],
        level: { gte: 2 },
        isActive: true,
      },
      orderBy: { accountCode: "asc" },
    });

    return NextResponse.json(accounts);
  } catch (error: any) {
    console.error('Error fetching payment accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment accounts', details: error.message },
      { status: 500 }
    );
  }
}
