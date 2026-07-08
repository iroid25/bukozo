import { PrismaClient, UserRole, Gender } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Starting E2E Testing Seed for Branches, Members, and Transactions...");

  // 1. Get Base Entities (Admin, AccTypes)
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) throw new Error("No ADMIN user found for processing. Run default seed first.");

  const savingsType = await prisma.accountType.findFirst({ where: { name: "Voluntary Savings Account" } }) ||
                      await prisma.accountType.findFirst({ where: { name: { contains: "Savings" } } });
  const fixedType = await prisma.accountType.findFirst({ where: { name: { contains: "Fixed" } } });
  const shareType = await prisma.accountType.findFirst({ where: { name: { contains: "Share" } } });
  
  if (!savingsType) throw new Error("Missing Savings account type");

  // 2. Setup Branches
  console.log("🏢 Setting up Kisinga and Kyarumba branches...");
  
  const branchesData = [
    { name: "Main Branch - Kisinga", location: "Kisinga" },
    { name: "Kyarumba", location: "Kyarumba" }
  ];

  const branches = [];
  for (const bData of branchesData) {
     const branch = await prisma.branch.upsert({
        where: { name: bData.name },
        update: {},
        create: { name: bData.name, location: bData.location }
     });
     branches.push(branch);
  }

  const memberPassword = await bcrypt.hash("Test@2026", 10);
  let memberCount = 0;

  for (const branch of branches) {
    console.log(`\n============ SEEDING BRANCH: ${branch.name} ============\n`);
    
    // Create 2 Institutions
    console.log("🏢 Creating 2 Institutions...");
    for (let i = 1; i <= 2; i++) {
       const userEmail = `inst_${branch.id.substring(0,4)}_${i}@bukonzosacco.ug`;
       let instUser = await prisma.user.findUnique({ where: { email: userEmail } });
       if (!instUser) {
          instUser = await prisma.user.create({
            data: {
              firstName: "Sacco",
              lastName: `Institute ${i}`,
              name: `Sacco Institute ${i} ${branch.location}`,
              email: userEmail,
              phone: `+256990${branch.id.substring(0,4)}${i}`,
              password: memberPassword,
              role: "INSTITUTION",
              isActive: true,
              branchId: branch.id,
              isVerified: true
            }
          });
       }

       await prisma.institution.upsert({
         where: { userId: instUser.id },
         update: {},
         create: {
            userId: instUser.id,
            registrationNumber: `REG-${branch.location?.substring(0,3) || 'UNK'}-${i}`,
            institutionNumber: `INST-${branch.location?.substring(0,3) || 'UNK'}-${i}`,
            institutionName: `Test Institution ${i} ${branch.location || ''}`,
            institutionType: "SCHOOL",
            primaryContactPerson: `Contact ${i}`,
            primaryContactPhone: `+25600000000${i}`,
            institutionPhone: `+25600000000${i}`,
            institutionEmail: userEmail,
            isApproved: true
         }
       });
    }

    // Create 18 Members
    console.log("👥 Creating 18 Members...");
    for (let i = 1; i <= 18; i++) {
        memberCount++;
        const userEmail = `testmember_${branch.id.substring(0,4)}_${i}@bukonzosacco.ug`;
        const phone = `+256770${String(memberCount).padStart(6, '0')}`;
        
        let memUser = await prisma.user.findFirst({ where: { OR: [{ email: userEmail }, { phone }] } });
        if (!memUser) {
           memUser = await prisma.user.create({
             data: {
                firstName: "Test",
                lastName: `Member ${i} ${branch.location}`,
                name: `Test Member ${i} ${branch.location}`,
                email: userEmail,
                phone: phone,
                password: memberPassword,
                role: "MEMBER",
                isActive: true,
                branchId: branch.id,
                isVerified: true
             }
           });
        }

        const member = await prisma.member.upsert({
          where: { userId: memUser.id },
          update: {},
          create: {
             userId: memUser.id,
             memberNumber: `MEM-TST-${branch.location.substring(0,3)}-${i}`,
             surname: `Member ${i}`,
             otherNames: "Test",
             gender: i % 2 === 0 ? Gender.FEMALE : Gender.MALE,
             status: "ACTIVE",
             isApproved: true,
             approvedByUserId: adminUser.id
          }
        });

        // Ensure savings account
        const accNumber = `SAV-TST-${branch.location.substring(0,3)}-${i}`;
        let account = await prisma.account.findUnique({ where: { accountNumber: accNumber }});
        if (!account) {
            account = await prisma.account.create({
               data: {
                  accountNumber: accNumber,
                  memberId: member.id,
                  accountTypeId: savingsType.id,
                  branchId: branch.id,
                  balance: 50000,
                  status: "ACTIVE"
               }
            });
        }
    }
  }

  console.log("\n✅ E2E Seed Testing Scaffold Complete. Run successful!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
