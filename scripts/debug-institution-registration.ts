import { db } from "../prisma/db.ts";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";

class Rollback extends Error {}

async function tryCreate(label: string, data: any) {
  console.log(`\n--- ${label} ---`);
  try {
    if (!data.institutionName || !data.institutionType) throw new Error("VALIDATION: name/type required");
    if (!data.institutionPhone) throw new Error("VALIDATION: phone required");
    if (!data.primaryContactPerson || !data.primaryContactPhone) throw new Error("VALIDATION: contact required");
    if (!data.branchId) throw new Error("VALIDATION: branch required");

    if (data.institutionEmail) {
      const existingEmail = await db.user.findUnique({ where: { email: data.institutionEmail } });
      if (existingEmail) throw new Error("CONFLICT: email already registered");
    }
    if (data.institutionPhone) {
      const existingPhone = await db.user.findUnique({ where: { phone: data.institutionPhone } });
      if (existingPhone) throw new Error("CONFLICT: phone already registered");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const institutionCount = await db.institution.count();
    const institutionNumber = `INST${String(institutionCount + 1).padStart(6, "0")}`;

    await db.$transaction(async (tx) => {
      const administrators = Array.isArray(data.administrators) ? data.administrators : [];

      const user = await tx.user.create({
        data: {
          firstName: data.institutionName,
          lastName: data.institutionType,
          name: data.institutionName,
          email: data.institutionEmail || null,
          phone: data.institutionPhone,
          password: hashedPassword,
          role: UserRole.INSTITUTION,
          branchId: data.branchId,
          isActive: false,
          isVerified: false,
          requiresPasswordChange: true,
        },
      });
      console.log(`  user created: ${user.id}`);

      const institution = await tx.institution.create({
        data: {
          user: { connect: { id: user.id } },
          institutionNumber,
          isApproved: false,
          institutionName: data.institutionName,
          institutionType: data.institutionType,
          registrationNumber: data.registrationNumber,
          tinNumber: data.tinNumber,
          legalStatus: data.legalStatus,
          yearEstablished: data.yearEstablished ? parseInt(data.yearEstablished) : null,
          businessSector: data.businessSector,
          numberOfEmployees: data.numberOfEmployees ? parseInt(data.numberOfEmployees) : null,
          majorObjective: data.majorObjective,
          majorActivities: data.majorActivities,
          founderNames: data.founderNames,
          plotNumber: data.plotNumber,
          street: data.street,
          village: data.village,
          parish: data.parish,
          subCounty: data.subCounty,
          constituency: data.constituency,
          town: data.town,
          district: data.district,
          postalAddress: data.postalAddress,
          primaryContactPerson: data.primaryContactPerson,
          primaryContactTitle: data.primaryContactTitle,
          primaryContactPhone: data.primaryContactPhone,
          primaryContactEmail: data.primaryContactEmail,
          institutionPhone: data.institutionPhone,
          institutionEmail: data.institutionEmail || null,
          accountTitle: data.accountTitle || data.institutionName,
          accountType: data.accountType,
          operatingInstructions: data.operatingInstructions,
          signatoryChangeRules: data.signatoryChangeRules,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          entryFee: data.entryFee ? parseFloat(data.entryFee) : 30000,
          initialDeposit: data.initialDeposit ? parseFloat(data.initialDeposit) : 20000,
          administrators: administrators.filter((admin: any) => admin.name && admin.post),
          additionalDocs: [],
        },
      });
      console.log(`  institution created: ${institution.id}`);

      const validAdmins = administrators.filter((a: any) => a.name && a.post);
      for (const admin of validAdmins) {
        await (tx as any).institutionSignatory.create({
          data: {
            institutionId: institution.id,
            name: admin.name,
            title: admin.post,
            phone: admin.phone || null,
            email: admin.email || null,
            signatureImage: admin.photo || admin.signature || null,
            isPrimary: false,
          },
        });
      }
      console.log(`  ${validAdmins.length} signatories created`);

      await tx.auditLog.create({
        data: {
          userId: data.currentUserId,
          action: "INSTITUTION_CREATED",
          entityType: "Institution",
          entityId: institution.id,
          newValue: {
            institutionNumber: institution.institutionNumber,
            institutionName: institution.institutionName,
            institutionType: institution.institutionType,
          },
          details: `Created institution: ${institution.institutionName}`,
        },
      });
      console.log("  audit log created");

      throw new Rollback("dry run - rolling back");
    });
  } catch (e: any) {
    if (e instanceof Rollback) {
      console.log("  SUCCESS (rolled back, no real error)");
    } else {
      console.log("  FAILED:", e.constructor.name, "-", e.message);
      if (e.code) console.log("  Prisma error code:", e.code, e.meta ? JSON.stringify(e.meta) : "");
    }
  }
}

async function main() {
  const branch = await db.branch.findFirst();
  if (!branch) {
    console.log("No branch exists in DB — can't test.");
    return;
  }
  const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
  console.log(`Using branch: ${branch.name} (${branch.id}), currentUser: ${adminUser?.id}`);

  const base = {
    institutionName: "Test Institution DRYRUN " + Math.random().toString(36).slice(2, 8),
    institutionType: "SCHOOL",
    institutionPhone: "0700" + Math.floor(Math.random() * 1000000).toString().padStart(6, "0"),
    primaryContactPerson: "Test Contact",
    primaryContactPhone: "0700111222",
    branchId: branch.id,
    password: "TestPass123",
    currentUserId: adminUser?.id,
    administrators: [
      { name: "Admin One", post: "Chairperson", phone: "0700000001", email: "" },
      { name: "Admin Two", post: "Secretary", phone: "0700000002", email: "" },
    ],
  };

  const mode = process.argv[2] || "with";
  if (mode === "with") {
    await tryCreate("WITH institutionEmail provided", { ...base, institutionEmail: "dryruntest_" + Date.now() + "@example.com" });
  } else if (mode === "undefined") {
    await tryCreate("WITHOUT institutionEmail (undefined) - simulating optional email", { ...base, institutionEmail: undefined, institutionPhone: base.institutionPhone + "1" });
  } else if (mode === "empty") {
    await tryCreate("WITH institutionEmail as empty string", { ...base, institutionEmail: "", institutionPhone: base.institutionPhone + "2" });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("SCRIPT ERROR:", e);
    await db.$disconnect();
    process.exit(1);
  });
