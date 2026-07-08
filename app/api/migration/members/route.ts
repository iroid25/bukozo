
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import * as bcrypt from "bcryptjs";
import { getAuthUser } from "@/config/useAuth";
import fs from "fs";
import path from "path";

// Helper function to clean phone number (shared logic)
function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\s/g, "").replace(/-/g, "");
  // Ensure proper Uganda format
  if (cleaned.startsWith("07")) {
    return `+256${cleaned.substring(1)}`;
  }
  if (cleaned.startsWith("256")) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("+256")) {
    return cleaned;
  }
  return null;
}

function parseSeedDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashParts = trimmed.split("/");
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMemberDateOfBirth(memberData: any): Date | null {
  return parseSeedDate(
    memberData.dateOfBirth ||
      memberData.dob ||
      memberData.birthDate ||
      memberData["Date of Birth"] ||
      memberData.date_of_birth,
  );
}

function getMemberIdCardValue(memberData: any): string | null {
  const rawId =
    memberData.idCard ||
    memberData.id_card ||
    memberData["ID Card"] ||
    memberData.nin ||
    memberData.nationalId ||
    memberData.national_id ||
    null;

  if (!rawId) return null;
  return String(rawId).trim().replace(/\s+/g, " ");
}

function getMemberNationalId(memberData: any): string | null {
  const rawId =
    memberData.idCard ||
    memberData.id_card ||
    memberData["ID Card"] ||
    memberData.nin ||
    memberData.nationalId ||
    memberData.national_id ||
    null;

  if (!rawId) return null;
  const normalized = String(rawId).trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
  return /^(CM|CF)[A-Z0-9]{13}$/.test(normalized) ? normalized : null;
}

function getMemberTypeOfId(memberData: any): string | null {
  const rawId = getMemberIdCardValue(memberData);
  if (!rawId) return null;
  if (/^(CM|CF)[A-Z0-9]{13}$/i.test(rawId)) {
    return "National Identity Card";
  }
  return rawId;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check - ADMIN only
    const user = await getAuthUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 401 }
      );
    }

    // 2. Load Data from JSON file
    const filePath = path.join(process.cwd(), "prisma", "extracted_members.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Migration file 'extracted_members.json' not found in prisma folder." },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const membersData = JSON.parse(fileContent);

    console.log(`[API] Starting member migration. Total records: ${membersData.length}`);

    // 3. Setup Dependencies
    const mainBranch = await db.branch.findFirst({
        where: { name: { contains: "Main Branch" } }
    }) || await db.branch.create({
        data: {
             name: "Main Branch - Kisinga",
             location: "Kisinga",
             contactPerson: "Manager",
             contactPhone: "+256000000000",
             email: "admin@sacco.com"
        }
    }); // Fallback if seed didn't run

    const manager = await db.user.findFirst({ where: { role: "BRANCHMANAGER" } }) || user;
    const loanOfficer = await db.user.findFirst({ where: { role: "LOANOFFICER" } }) || user;

    const savingsType = await db.accountType.findFirst({ where: { name: "Savings Account" } });
    if (!savingsType) return NextResponse.json({ error: "Savings Account Type not configured" }, { status: 500 });
    
    // Ensure Loan Products exist
    const personalLoan = await db.loanProduct.upsert({
        where: { name: "Personal Loan" },
        update: {},
        create: {
            name: "Personal Loan",
            minAmount: 100000,
            maxAmount: 5000000,
            interestRate: 15.0,
            repaymentPeriodDays: 365,
            description: "Personal loan for members",
        }
    });

    const memberPassword = await bcrypt.hash("Member@2026", 10);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 4. Batch Processing
    // Note: In a real serverless env this might timeout. 
    // We are trusting standard timeouts or self-hosted runtime.
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < membersData.length; i += BATCH_SIZE) {
        const batch = membersData.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (memberData: any, batchIndex: number) => {
            const globalIndex = i + batchIndex;
            try {
                // Name splitting
                const nameParts = memberData.name.trim().split(" ");
                const firstName = nameParts[0] || memberData.name;
                const lastName = nameParts.slice(1).join(" ") || nameParts[0];

                // Gender deduction
                const femaleIndicators = ["mrs", "ms", "miss", "esther", "sarah", "mary", "jane"];
                const nameToCheck = memberData.name.toLowerCase();
                const gender = femaleIndicators.some((indicator) => nameToCheck.includes(indicator)) ? "FEMALE" : "MALE";

                // Phone cleaning
                const cleanedPhone = cleanPhone(memberData.phone);
                const dateOfBirth = getMemberDateOfBirth(memberData);
                const memberIdCardType = getMemberTypeOfId(memberData);
                
                if (!cleanedPhone) {
                    // errorCount++; // Skip without error, often just bad data
                    return;
                }

                // Create/Find User
                let memberUser = await db.user.findUnique({ where: { phone: cleanedPhone } });
                
                if (!memberUser) {
                    memberUser = await db.user.create({
                        data: {
                            firstName: firstName,
                            lastName: lastName,
                            name: memberData.name,
                            email: null,
                            password: memberPassword,
                            phone: cleanedPhone, // Unique identifier
                            address: memberData.address || null,
                            dateOfBirth,
                            role: "MEMBER",
                            isActive: true, // Auto-activate imported users
                            isVerified: false,
                            branchId: mainBranch.id,
                            requiresPasswordChange: true,
                            createdAt: new Date(), 
                        }
                    });
                }

                // Create/Find Member Record
                const member = await db.member.upsert({
                    where: { userId: memberUser.id },
                    update: {
                        nin: getMemberNationalId(memberData),
                        typeOfId: memberIdCardType,
                        surname: lastName,
                        otherNames: firstName,
                        gender,
                        status: "ACTIVE",
                        isApproved: true, // Auto-approve legacy members
                    },
                    create: {
                        userId: memberUser.id,
                        memberNumber: memberData.account_numbers[0] || `MEM${String(globalIndex + 1).padStart(6, "0")}`,
                        surname: lastName,
                        otherNames: firstName,
                        gender,
                        status: "ACTIVE",
                        isApproved: true, // Auto-approve legacy members
                        nin: getMemberNationalId(memberData),
                        typeOfId: memberIdCardType,
                        createdAt: new Date(),
                        approvalStatus: "APPROVED",
                        approvedByUserId: user.id,
                        approvedAt: new Date()
                    }
                });

                // Intentionally do not seed accounts, loans, or transactions here.
                // The imported member register should only create member identities.

                successCount++;
            } catch (err: any) {
                errorCount++;
                if (errors.length < 20) errors.push(`${memberData.name}: ${err.message}`);
                console.error(`[API] Error processing ${memberData.name}:`, err);
            }
        }));
    }

    return NextResponse.json({
        success: true,
        data: {
            processed: membersData.length,
            success: successCount,
            errors: errorCount,
            errorDetails: errors,
            message: "Member migration completed successfully"
        }
    });

  } catch (error: any) {
    console.error("[API] Migration Error:", error);
    return NextResponse.json(
        { error: error.message || "Internal Server Error" }, 
        { status: 500 }
    );
  }
}
