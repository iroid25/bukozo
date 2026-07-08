import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";

// Config Keys
const KEYS = {
  MEMBER_RATES: "TELLER_WITHDRAWAL_RATES_MEMBER",
  INSTITUTION_RATES: "TELLER_WITHDRAWAL_RATES_INSTITUTION",
};

// Schema for a single tier
const tierSchema = z.object({
  min: z.number().min(0),
  max: z.number().nullable(), // null means "and above"
  fee: z.number().min(0),
});

// Schema for update request
const updateSchema = z.object({
  memberRates: z.array(tierSchema).optional(),
  institutionRates: z.array(tierSchema).optional(),
});

type WithdrawalRateTier = z.infer<typeof tierSchema>;

// Default configurations based on user request
const DEFAULT_MEMBER_RATES: WithdrawalRateTier[] = [
  { min: 5000, max: 1000000, fee: 300 },
  { min: 1000001, max: 2000000, fee: 500 },
  { min: 2000001, max: 4000000, fee: 1000 },
  { min: 4000001, max: 4999999, fee: 1500 },
  { min: 5000000, max: null, fee: 2000 },
];

const DEFAULT_INSTITUTION_RATES: WithdrawalRateTier[] = [
  { min: 5000, max: 2000000, fee: 1000 },
  { min: 2000001, max: 5000000, fee: 2000 },
  { min: 5000001, max: null, fee: 3000 },
];

export async function GET() {
  try {
    const configs = await db.systemConfiguration.findMany({
      where: {
        key: { in: [KEYS.MEMBER_RATES, KEYS.INSTITUTION_RATES] },
        isActive: true,
      },
    });

    const configMap: Record<string, any> = {};
    configs.forEach((c) => {
      try {
        configMap[c.key] = JSON.parse(c.value);
      } catch (e) {
        console.error(`Error parsing config for ${c.key}`, e);
      }
    });

    return NextResponse.json({
      memberRates: configMap[KEYS.MEMBER_RATES] || DEFAULT_MEMBER_RATES,
      institutionRates: configMap[KEYS.INSTITUTION_RATES] || DEFAULT_INSTITUTION_RATES,
    });
  } catch (error) {
    console.error("Error fetching withdrawal config:", error);
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { memberRates, institutionRates } = validation.data;

    await db.$transaction(async (tx) => {
      if (memberRates) {
        await tx.systemConfiguration.upsert({
          where: { key: KEYS.MEMBER_RATES },
          update: {
            value: JSON.stringify(memberRates),
            updatedBy: session.user.id,
          },
          create: {
            key: KEYS.MEMBER_RATES,
            value: JSON.stringify(memberRates),
            dataType: "JSON",
            description: "Tiered withdrawal rates for members",
            category: "WITHDRAWAL",
            isActive: true,
            updatedBy: session.user.id,
          },
        });
      }

      if (institutionRates) {
        await tx.systemConfiguration.upsert({
          where: { key: KEYS.INSTITUTION_RATES },
          update: {
            value: JSON.stringify(institutionRates),
            updatedBy: session.user.id,
          },
          create: {
            key: KEYS.INSTITUTION_RATES,
            value: JSON.stringify(institutionRates),
            dataType: "JSON",
            description: "Tiered withdrawal rates for institutions",
            category: "WITHDRAWAL",
            isActive: true,
            updatedBy: session.user.id,
          },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Configuration updated" });
  } catch (error) {
    console.error("Error updating withdrawal config:", error);
    return NextResponse.json(
      { error: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
