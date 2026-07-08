import bcrypt from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  WithdrawalMandate,
} from "@prisma/client";

const KISINGA_INSTITUTIONS = [
  "Divine Junior School",
  "Divine Junior School",
  "Kasokero C.O.U El-salvador",
  "STANDARD Kindergarten",
  "Sayuni Church Of Uganda",
  "Kagango 11 Rural",
  "Nyabirongo Village",
  "Erisa Muekya & Sons",
  "Kisinga SDA Primary School",
  "Forum For Savings & Credit",
  "S.D.A Church Mughende",
  "Five Star Enterprises",
  "Rwenzori Life Revival",
  "St Peter's Betesaida Church",
  "God Cares Nursery & Primary",
  "Kisinga United Motorcyclists",
  "Kisinga Muthoma Youth",
  "Kisinga Town Council",
  "KAJWENGE TEACHERS",
  "Joint Friends Group",
  "Divine Junior School",
  "Mothers Union Kisinga",
  "Rwesororo C.O.U Primary",
  "S.D.A Church Mughende",
  "ST. Michael Kasokero",
  "KYONDO SUBCOUNTY",
  "KYONDO SUBCOUNTY",
  "Kasokero C.O.U El-salvador",
  "Kasokero C.O.U El-salvador",
  "STANDARD Kindergarten",
  "Kasusu Medical Savings",
  "Family of God Couples",
  "IHANURA VANILLA",
  "Team No Sleep - Kisinga",
  "Kisinga SDA Primary School",
  "St Peters Catholic Church",
  "Kisinga Town Council",
  "Katsetsebya",
  "Rwanguhya Primary School",
  "Bukonzo United Traders",
  "Team University Kasese",
  "All Saints Musasa C.O.U",
  "Lhuhwahwa Poultry",
  "Ukuthe Programme Boys",
  "Kirembo Medical Centre",
  "Kagando College Of",
  "Little Angels Primary School",
  "All Saints Burumbika",
  "Rwenzori Multiple Service",
  "St Johns Kabwe Romans",
  "Kamughobe Farmers Forum",
  "St. Andrews Kanughunya",
  "KACUNGIRO PRIMARY",
  "KISINGA MAIN MOSQUE",
  "Baswagha Basita",
  "KISINGA FOUNDATION",
  "Kafude Abitsukulhu",
  "Busimba Grand Children",
  "Mukera Foundation",
  "Kinywankoko Twanzane",
  "Foundation For Women",
  "Kajwenge United Builders",
  "Nyakaina Women and Men",
  "Nyabirongo-Kisinga PDM",
  "Rwenzori United",
  "ST Johns Kisinga COU",
  "Kisinga Zone Radio Messiah",
  "Kagando Kisinga PDM",
  "Birurutha-Mayele Saving",
  "YES WE CAN",
  "Team Visit Bwana",
  "St. Egidio Group 1",
  "Glorious Catechists' Family",
  "Busyangwa Pioneers",
  "Kanyabusogha Primary",
  "Trust Sacco",
  "Mupaghasa Paul Legacy",
  "Bukonzo Funeral Services",
];

function sanitizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

function getInstitutionType(name: string) {
  const lower = name.toLowerCase();
  if (
    lower.includes("school") ||
    lower.includes("kindergarten") ||
    lower.includes("primary") ||
    lower.includes("college") ||
    lower.includes("education")
  ) {
    return "SCHOOL";
  }
  if (lower.includes("church") || lower.includes("mosque")) {
    return "RELIGIOUS";
  }
  if (lower.includes("sacco") || lower.includes("saving") || lower.includes("credit")) {
    return "SACCO";
  }
  if (lower.includes("council") || lower.includes("subcounty") || lower.includes("subcounty")) {
    return "GOVERNMENT";
  }
  return "ASSOCIATION";
}

export async function seedKisingaInstitutions(
  prisma: PrismaClient,
  branchId: string,
) {
  const password = await bcrypt.hash("Institution@2026", 10);
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, location: true },
  });

  if (!branch) {
    throw new Error(`Branch not found for institution seeding: ${branchId}`);
  }

  let created = 0;
  let updated = 0;

  for (let index = 0; index < KISINGA_INSTITUTIONS.length; index++) {
    const institutionName = KISINGA_INSTITUTIONS[index];
    const suffix = String(index + 1).padStart(4, "0");
    const institutionNumber = `KIS-${suffix}`;
    const institutionEmail = `${sanitizeSlug(institutionName)}-${suffix}@kisinga.bukonzosacco.ug`;
    const institutionPhone = `+25676${suffix.slice(-4).padStart(4, "0")}`;
    const contactPerson = `${institutionName.split(" ")[0]} Director`;

    const existing = await prisma.institution.findUnique({
      where: { institutionNumber },
      include: { user: true },
    });

    const institutionData = {
      institutionName,
      institutionType: getInstitutionType(institutionName),
      registrationDate: new Date(),
      isApproved: false,
      institutionNumber,
      primaryContactPerson: contactPerson,
      primaryContactTitle: "Director",
      primaryContactPhone: institutionPhone,
      primaryContactEmail: null,
      institutionPhone,
      institutionEmail,
      bankName: null,
      bankAccountNumber: null,
      accountTitle: institutionName,
      accountType: "Current Account",
      operatingInstructions: null,
      signatoryChangeRules: null,
      administrators: [],
      entryFee: null,
      initialDeposit: null,
      approvalDate: null,
      rejectionReason: null,
      approvedBySignature: null,
      cashierSignature: null,
      officialStamp: null,
      registrationCertPath: null,
      lcRecommendationPath: null,
      minutesPath: null,
      bylawsPath: null,
      additionalDocs: [],
      withdrawalMandate: WithdrawalMandate.ALL_SIGNATORIES,
      withdrawalMandateText: null,
      userId: existing?.userId ?? "",
    };

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            name: institutionName,
            firstName: institutionName,
            lastName: "Institution",
            email: institutionEmail,
            phone: institutionPhone,
            branchId: branch.id,
            role: UserRole.INSTITUTION,
            isActive: false,
            isVerified: false,
            requiresPasswordChange: true,
          },
        });

        await tx.institution.update({
          where: { id: existing.id },
          data: {
            ...institutionData,
            userId: existing.userId,
          },
        });
      });
      updated++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: institutionName,
          firstName: institutionName,
          lastName: "Institution",
          email: institutionEmail,
          phone: institutionPhone,
          password,
          branchId: branch.id,
          role: UserRole.INSTITUTION,
          isActive: false,
          isVerified: false,
          requiresPasswordChange: true,
        },
      });

      await tx.institution.create({
        data: {
          ...institutionData,
          userId: user.id,
        },
      });
    });

    created++;
  }

  return {
    branch: branch.name,
    created,
    updated,
    total: KISINGA_INSTITUTIONS.length,
  };
}
