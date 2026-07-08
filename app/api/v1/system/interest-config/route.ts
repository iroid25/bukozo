import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { z } from "zod";

// Validation schema for interest configuration updates
const interestConfigSchema = z.object({
  defaultInterestType: z.enum(["FLAT_RATE", "REDUCING_BALANCE"]).optional(),
  defaultLoanInterestRate: z.number().min(0).max(300).optional(),
  maxInterestRate: z.number().min(0).max(300).optional(),
  minInterestRate: z.number().min(0).max(300).optional(),
  allowInterestTypeOverride: z.boolean().optional(),
  savingsInterestRate: z.number().min(0).max(100).optional(),
  fixedDepositInterestRate: z.number().min(0).max(100).optional(),
});

type InterestConfig = z.infer<typeof interestConfigSchema>;

// Configuration keys
const CONFIG_KEYS = {
  DEFAULT_INTEREST_TYPE: "DEFAULT_INTEREST_TYPE",
  DEFAULT_LOAN_INTEREST_RATE: "DEFAULT_LOAN_INTEREST_RATE",
  MAX_INTEREST_RATE: "MAX_INTEREST_RATE",
  MIN_INTEREST_RATE: "MIN_INTEREST_RATE",
  ALLOW_INTEREST_TYPE_OVERRIDE: "ALLOW_INTEREST_TYPE_OVERRIDE",
  SAVINGS_INTEREST_RATE: "SAVINGS_INTEREST_RATE",
  FIXED_DEPOSIT_INTEREST_RATE: "FIXED_DEPOSIT_INTEREST_RATE",
};

/**
 * GET /api/v1/system/interest-config
 * Fetch all interest configuration settings
 */
export async function GET() {
  // Default configuration values
  const defaultConfig = {
    defaultInterestType: "FLAT_RATE" as const,
    defaultLoanInterestRate: 15,
    maxInterestRate: 100,
    minInterestRate: 0,
    allowInterestTypeOverride: true,
    savingsInterestRate: 5,
    fixedDepositInterestRate: 8,
  };

  try {
    // Check if SystemConfiguration table exists
    const tableExists = await db.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SystemConfiguration'
      );
    `.catch(() => null);

    // If table doesn't exist, return defaults with a warning
    if (!tableExists || !(tableExists as any[])[0]?.exists) {
      console.warn('⚠️  SystemConfiguration table not found. Returning default values.');
      console.warn('   Please run: npx prisma migrate dev --name add_system_configuration');
      return NextResponse.json(defaultConfig);
    }

    // Fetch all interest-related configurations
    const configs = await db.systemConfiguration.findMany({
      where: {
        category: "INTEREST",
        isActive: true,
      },
    });

    // Transform to object format
    const configMap: Record<string, any> = {};
    configs.forEach((config) => {
      let value: any = config.value;
      
      // Parse based on dataType
      if (config.dataType === "NUMBER") {
        value = parseFloat(config.value);
      } else if (config.dataType === "BOOLEAN") {
        value = config.value === "true";
      }
      
      configMap[config.key] = value;
    });

    // Return with defaults if not set
    const response = {
      defaultInterestType: configMap[CONFIG_KEYS.DEFAULT_INTEREST_TYPE] || defaultConfig.defaultInterestType,
      defaultLoanInterestRate: configMap[CONFIG_KEYS.DEFAULT_LOAN_INTEREST_RATE] || defaultConfig.defaultLoanInterestRate,
      maxInterestRate: configMap[CONFIG_KEYS.MAX_INTEREST_RATE] || defaultConfig.maxInterestRate,
      minInterestRate: configMap[CONFIG_KEYS.MIN_INTEREST_RATE] || defaultConfig.minInterestRate,
      allowInterestTypeOverride: configMap[CONFIG_KEYS.ALLOW_INTEREST_TYPE_OVERRIDE] ?? defaultConfig.allowInterestTypeOverride,
      savingsInterestRate: configMap[CONFIG_KEYS.SAVINGS_INTEREST_RATE] || defaultConfig.savingsInterestRate,
      fixedDepositInterestRate: configMap[CONFIG_KEYS.FIXED_DEPOSIT_INTEREST_RATE] || defaultConfig.fixedDepositInterestRate,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching interest configuration:", error);
    
    // If it's a Prisma error about missing table, return defaults
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.warn('⚠️  Database error. Returning default configuration.');
      return NextResponse.json(defaultConfig);
    }
    
    return NextResponse.json(
      { error: "Failed to fetch interest configuration" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/system/interest-config
 * Update interest configuration settings (Admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check authentication
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization - Admin only
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = interestConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Business rule validation
    if (
      data.maxInterestRate !== undefined &&
      data.minInterestRate !== undefined &&
      data.maxInterestRate <= data.minInterestRate
    ) {
      return NextResponse.json(
        { error: "Maximum interest rate must be greater than minimum interest rate" },
        { status: 400 }
      );
    }

    // Update configurations in transaction
    await db.$transaction(async (tx) => {
      const updates: Array<{
        key: string;
        value: string;
        dataType: string;
        description: string;
      }> = [];

      if (data.defaultInterestType !== undefined) {
        updates.push({
          key: CONFIG_KEYS.DEFAULT_INTEREST_TYPE,
          value: data.defaultInterestType,
          dataType: "STRING",
          description: "Default interest calculation type for new loan products",
        });
      }

      if (data.defaultLoanInterestRate !== undefined) {
        updates.push({
          key: CONFIG_KEYS.DEFAULT_LOAN_INTEREST_RATE,
          value: data.defaultLoanInterestRate.toString(),
          dataType: "NUMBER",
          description: "Default interest rate percentage for new loan products",
        });
      }

      if (data.maxInterestRate !== undefined) {
        updates.push({
          key: CONFIG_KEYS.MAX_INTEREST_RATE,
          value: data.maxInterestRate.toString(),
          dataType: "NUMBER",
          description: "Maximum allowed interest rate percentage",
        });
      }

      if (data.minInterestRate !== undefined) {
        updates.push({
          key: CONFIG_KEYS.MIN_INTEREST_RATE,
          value: data.minInterestRate.toString(),
          dataType: "NUMBER",
          description: "Minimum allowed interest rate percentage",
        });
      }

      if (data.allowInterestTypeOverride !== undefined) {
        updates.push({
          key: CONFIG_KEYS.ALLOW_INTEREST_TYPE_OVERRIDE,
          value: data.allowInterestTypeOverride.toString(),
          dataType: "BOOLEAN",
          description: "Allow loan applications to override product interest type",
        });
      }

      if (data.savingsInterestRate !== undefined) {
        updates.push({
          key: CONFIG_KEYS.SAVINGS_INTEREST_RATE,
          value: data.savingsInterestRate.toString(),
          dataType: "NUMBER",
          description: "Default interest rate for savings accounts",
        });
      }

      if (data.fixedDepositInterestRate !== undefined) {
        updates.push({
          key: CONFIG_KEYS.FIXED_DEPOSIT_INTEREST_RATE,
          value: data.fixedDepositInterestRate.toString(),
          dataType: "NUMBER",
          description: "Default interest rate for fixed deposit accounts",
        });
      }

      // Upsert each configuration
      for (const update of updates) {
        await tx.systemConfiguration.upsert({
          where: { key: update.key },
          update: {
            value: update.value,
            updatedBy: session.user.id,
          },
          create: {
            key: update.key,
            value: update.value,
            dataType: update.dataType,
            description: update.description,
            category: "INTEREST",
            isActive: true,
            updatedBy: session.user.id,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Interest configuration updated successfully",
    });
  } catch (error) {
    console.error("Error updating interest configuration:", error);
    return NextResponse.json(
      { error: "Failed to update interest configuration" },
      { status: 500 }
    );
  }
}
