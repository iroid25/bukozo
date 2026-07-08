import { PrismaClient, UserRole, TransactionType, TransactionStatus, LoanStatus, LoanStage, FixedDepositStatus, CategoryKind, PaymentMethod, RecognitionBasis, AssetStatus, AssetType, Gender } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Starting Comprehensive E2E Testing Seed V2...");

  // 1. Fetch Base Data (Account Types & Loan Products)
  const accountTypes = await prisma.accountType.findMany();
  const loanProducts = await prisma.loanProduct.findMany();

  const voluntarySavingsType = accountTypes.find(t => t.name === "Voluntary Savings Account");
  const compulsorySavingsType = accountTypes.find(t => t.name === "Compulsory Savings");
  const fixedDepositType = accountTypes.find(t => t.name.includes("Fixed Deposit"));
  const shareCapitalType = accountTypes.find(t => t.name === "Share Capital");
  const ordinarySharesType = accountTypes.find(t => t.name === "Ordinary Shares Account");
  const affiliateSharesType = accountTypes.find(t => t.name === "Affiliate Shares Account");
  const associateSharesType = accountTypes.find(t => t.name === "Associate Shares Account");
  
  if (!voluntarySavingsType || !compulsorySavingsType || !fixedDepositType || !ordinarySharesType) {
    throw new Error("Missing critical Account Types in database. Run default seed first.");
  }

  // 2. Setup/Validate Branches
  const kisinga = await prisma.branch.findUnique({ where: { name: "Main Branch - Kisinga" } });
  const kyarumba = await prisma.branch.findUnique({ where: { name: "Kyarumba" } });

  if (!kisinga || !kyarumba) {
    throw new Error("Missing Kisinga or Kyarumba branches. Please ensure they exist with the specified names.");
  }

  // 3. Ensure Admin & Branch Employees exist
  const adminPassword = await bcrypt.hash("Admin@2026", 10);
  const employeePassword = await bcrypt.hash("Staff@2026", 10);
  const memberPassword = await bcrypt.hash("Test@2026", 10);

  let adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        firstName: "System",
        lastName: "Admin",
        name: "System Admin",
        email: "admin@bukonzosacco.ug",
        phone: "+256000000000",
        password: adminPassword,
        role: "ADMIN",
        isActive: true,
        isVerified: true
      }
    });
  }

  const branches = [kisinga, kyarumba];
  const staff = [];

  for (const branch of branches) {
    console.log(`👷 Setting up staff for branch: ${branch.name}`);
    
    const roleSuffix = branch.name.includes("Kisinga") ? "KSG" : "KYR";
    const tellerEmail = `teller_${roleSuffix.toLowerCase()}@bukonzosacco.ug`;
    const managerEmail = `manager_${roleSuffix.toLowerCase()}@bukonzosacco.ug`;

    let teller = await prisma.user.findUnique({ where: { email: tellerEmail } });
    if (!teller) {
      teller = await prisma.user.create({
        data: {
          firstName: "Branch",
          lastName: `Teller ${roleSuffix}`,
          name: `Branch Teller ${roleSuffix}`,
          email: tellerEmail,
          password: employeePassword,
          role: "TELLER",
          isActive: true,
          branchId: branch.id,
          isVerified: true
        }
      });
    }

    let manager = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!manager) {
      manager = await prisma.user.create({
        data: {
          firstName: "Branch",
          lastName: `Manager ${roleSuffix}`,
          name: `Branch Manager ${roleSuffix}`,
          email: managerEmail,
          password: employeePassword,
          role: "BRANCHMANAGER",
          isActive: true,
          branchId: branch.id,
          isVerified: true
        }
      });
    }

    staff.push({ branchId: branch.id, tellerId: teller.id, managerId: manager.id });
  }

  console.log("✅ Base setup complete. Ready to seed members and institutions.");

  const allMembers = [];
  const allInstitutions = [];

  for (const branch of branches) {
    console.log(`\n============== Seeding entities for Branch: ${branch.name} ==============`);
    
    // a. Create 2 Institutions
    console.log("🏢 Creating 2 Institutions...");
    for (let i = 1; i <= 2; i++) {
      const email = `inst_${branch.id.substring(0, 4)}_${i}@bukonzosacco.ug`;
      const phone = `+256901${branch.id.substring(0, 4)}${i}`;
      
      let instUser = await prisma.user.findFirst({ 
        where: { OR: [{ email }, { phone }] } 
      });
      if (!instUser) {
        instUser = await prisma.user.create({
          data: {
            firstName: "Sacco",
            lastName: `Institute ${i} ${branch.name}`,
            name: `Sacco Institute ${i} ${branch.name}`,
            email,
            phone,
            password: memberPassword,
            role: "INSTITUTION",
            isActive: true,
            branchId: branch.id,
            isVerified: true
          }
        });
      }

      const institution = await prisma.institution.upsert({
        where: { userId: instUser.id },
        update: {},
        create: {
          userId: instUser.id,
          registrationNumber: `REG-INST-${branch.id.substring(0, 3)}-${i}`,
          institutionNumber: `INST-${branch.id.substring(0, 3)}-${i}`,
          institutionName: `Test Institution ${i} ${branch.name}`,
          institutionType: i % 2 === 0 ? "SCHOOL" : "CHURCH",
          primaryContactPerson: `Manager ${i}`,
          primaryContactPhone: phone,
          institutionPhone: phone,
          institutionEmail: email,
          isApproved: true
        }
      });

      // Open Accounts
      const savingsAcc = await prisma.account.upsert({
        where: { accountNumber: `SAV-INST-${branch.id.substring(0, 3)}-${i}` },
        update: {},
        create: {
          accountNumber: `SAV-INST-${branch.id.substring(0, 3)}-${i}`,
          institutionId: institution.id,
          accountTypeId: voluntarySavingsType.id,
          branchId: branch.id,
          balance: 0,
          status: "ACTIVE"
        }
      });

      allInstitutions.push({ id: institution.id, savingsAccountId: savingsAcc.id, branchId: branch.id });
    }

    // b. Create 18 Members
    console.log("👥 Creating 18 Members...");
    for (let i = 1; i <= 18; i++) {
        const memEmail = `testmem_${branch.id.substring(0, 4)}_${i}@bukonzosacco.ug`;
        const memPhone = `+256701${branch.id.substring(0, 4)}${String(i).padStart(2,'0')}`;
        
        let memUser = await prisma.user.findFirst({ 
          where: { OR: [{ email: memEmail }, { phone: memPhone }] } 
        });
        if (!memUser) {
            memUser = await prisma.user.create({
                data: {
                    firstName: `Member${i}`,
                    lastName: `Testing ${branch.name}`,
                    name: `Member${i} Testing ${branch.name}`,
                    email: memEmail,
                    phone: memPhone,
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
                memberNumber: `MEM-${branch.id.substring(0, 3)}-${String(i).padStart(3,'0')}`,
                surname: `Testing${i}`,
                otherNames: branch.name,
                status: "ACTIVE",
                approvalStatus: "APPROVED",
                isApproved: true,
                approvedByUserId: adminUser.id
            }
        });

        const savingsAcc = await prisma.account.upsert({
            where: { accountNumber: `SAV-MEM-${branch.id.substring(0, 3)}-${String(i).padStart(3,'0')}` },
            update: {},
            create: {
                accountNumber: `SAV-MEM-${branch.id.substring(0, 3)}-${String(i).padStart(3,'0')}`,
                memberId: member.id,
                accountTypeId: voluntarySavingsType.id,
                branchId: branch.id,
                balance: 0,
                status: "ACTIVE"
            }
        });

        let compulsoryAccountId = null;
        if (i <= 7) {
            const compAcc = await prisma.account.upsert({
                where: { accountNumber: `COM-MEM-${branch.id.substring(0, 3)}-${String(i).padStart(3,'0')}` },
                update: {},
                create: {
                    accountNumber: `COM-MEM-${branch.id.substring(0, 3)}-${String(i).padStart(3,'0')}`,
                    memberId: member.id,
                    accountTypeId: compulsorySavingsType.id,
                    branchId: branch.id,
                    balance: 0,
                    status: "ACTIVE"
                }
            });
            compulsoryAccountId = compAcc.id;
        }

        allMembers.push({ id: member.id, savingsAccountId: savingsAcc.id, compulsoryAccountId: compulsoryAccountId, branchId: branch.id });
    }
  }

  console.log("✅ Members and Institutions seeded.");

  // 4. Generate Transactions (Deposits, Withdrawals)
  console.log("\n💰 Generating Savings Transactions...");
  const allEntities = [
    ...allMembers.map(m => ({ id: m.id, type: 'MEMBER' as const, savingsAccountId: m.savingsAccountId, branchId: m.branchId })), 
    ...allInstitutions.map(i => ({ id: i.id, type: 'INSTITUTION' as const, savingsAccountId: i.savingsAccountId, branchId: i.branchId }))
  ];

  for (const entity of allEntities) {
    const branchStaff = staff.find(s => s.branchId === entity.branchId);
    if (!branchStaff) continue;
    
    // 5 Deposits each
    for (let d = 1; d <= 5; d++) {
      const amount = 100000 + Math.floor(Math.random() * 400000);
      const txRef = `DEP-${entity.id.substring(0,5)}-${d}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      
      const transaction = await prisma.transaction.create({
        data: {
          transactionRef: txRef,
          accountId: entity.savingsAccountId,
          type: "DEPOSIT",
          amount: amount,
          status: "COMPLETED",
          description: `Test Deposit ${d}`,
          transactionDate: new Date(),
          processedByUserId: branchStaff.tellerId,
          branchId: entity.branchId,
          memberId: entity.type === 'MEMBER' ? entity.id : null,
          institutionId: entity.type === 'INSTITUTION' ? entity.id : null,
        }
      });

      await prisma.deposit.create({
        data: {
          transactionId: transaction.id,
          accountId: entity.savingsAccountId,
          amount: amount,
          handlerUserId: branchStaff.tellerId,
          channel: "CASH",
          memberId: entity.type === 'MEMBER' ? entity.id : null,
          institutionId: entity.type === 'INSTITUTION' ? entity.id : null,
        }
      });

      await prisma.account.update({
        where: { id: entity.savingsAccountId },
        data: { balance: { increment: amount } }
      });
    }

    // 5 Withdrawals each
    for (let w = 1; w <= 5; w++) {
      const amount = 5000 + Math.floor(Math.random() * 20000);
      const txRef = `WTH-${entity.id.substring(0,5)}-${w}-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
      
      const transaction = await prisma.transaction.create({
        data: {
          transactionRef: txRef,
          accountId: entity.savingsAccountId,
          type: "WITHDRAWAL",
          amount: amount,
          status: "COMPLETED",
          description: `Test Withdrawal ${w}`,
          transactionDate: new Date(),
          processedByUserId: branchStaff.tellerId,
          branchId: entity.branchId,
          memberId: entity.type === 'MEMBER' ? entity.id : null,
          institutionId: entity.type === 'INSTITUTION' ? entity.id : null,
        }
      });

      await prisma.withdrawal.create({
        data: {
          transactionId: transaction.id,
          accountId: entity.savingsAccountId,
          amount: amount,
          handlerUserId: branchStaff.tellerId,
          channel: "CASH",
          memberId: entity.type === 'MEMBER' ? entity.id : null,
          institutionId: entity.type === 'INSTITUTION' ? entity.id : null,
        }
      });

      await prisma.account.update({
        where: { id: entity.savingsAccountId },
        data: { balance: { decrement: amount } }
      });
    }
  }

  console.log("✅ Savings transactions generated.");

  // 5. Generate Loans
  console.log("\n📈 Generating Loans...");
  for (const entity of allEntities) {
    const branchStaff = staff.find(s => s.branchId === entity.branchId);
    if (!branchStaff) continue;

    const numLoans = Math.floor(Math.random() * 2) + 1;
    for (let l = 1; l <= numLoans; l++) {
      const loanProduct = loanProducts[Math.floor(Math.random() * loanProducts.length)];
      const amount = Math.floor(Math.random() * (loanProduct.maxAmount - loanProduct.minAmount)) + loanProduct.minAmount;
      
      if (entity.type === 'MEMBER') {
        const application = await prisma.loanApplication.create({
          data: {
            memberId: entity.id,
            loanProductId: loanProduct.id,
            amountApplied: amount,
            status: "DISBURSED",
            stage: "DISBURSED",
            applicationDate: new Date(Date.now() - 30 * 24 *60*60*1000),
            approvalDate: new Date(Date.now() - 25 * 24 *60*60*1000),
            approvedAmount: amount,
            approverId: branchStaff.managerId,
            loanOfficerId: branchStaff.tellerId,
            disbursedAt: new Date(Date.now() - 24 * 24 *60*60*1000),
          }
        });

        const loan = await prisma.loan.create({
          data: {
            loanApplicationId: application.id,
            memberId: entity.id,
            amountGranted: amount,
            interestRate: loanProduct.interestRate,
            totalAmountDue: amount * 1.15,
            outstandingBalance: amount * 1.15,
            dueDate: new Date(Date.now() + 30 * 24 *60*60*1000),
            status: "DISBURSED",
            branchId: entity.branchId,
          }
        });

        const repayAmt = (loan.totalAmountDue / 12);
        const lrpTx = await prisma.transaction.create({
            data: {
                transactionRef: `LRP-${loan.id.substring(0,5)}-${Date.now()}`,
                accountId: entity.savingsAccountId,
                type: "LOAN_REPAYMENT",
                amount: repayAmt,
                status: "COMPLETED",
                branchId: entity.branchId,
                memberId: entity.id,
                loanId: loan.id
            }
        });

        await prisma.loanRepayment.create({
            data: {
                loanId: loan.id,
                memberId: entity.id,
                amount: repayAmt,
                handlerUserId: branchStaff.tellerId,
                channel: "CASH",
                transactionId: lrpTx.id
            }
        });

        await prisma.loan.update({
            where: { id: loan.id },
            data: {
                amountPaid: repayAmt,
                outstandingBalance: { decrement: repayAmt }
            }
        });
      } else {
        const application = await prisma.institutionLoanApplication.create({
          data: {
            institutionId: entity.id,
            loanProductId: loanProduct.id,
            amountApplied: amount,
            status: "DISBURSED",
            stage: "DISBURSED",
            applicationDate: new Date(Date.now() - 30 * 24 *60*60*1000),
            approvedAmount: amount,
          }
        });

        const loan = await prisma.institutionLoan.create({
          data: {
            applicationId: application.id,
            institutionId: entity.id,
            amountGranted: amount,
            interestRate: loanProduct.interestRate,
            totalAmountDue: amount * 1.15,
            outstandingBalance: amount * 1.15,
            dueDate: new Date(Date.now() + 30 * 24 *60*60*1000),
            status: "DISBURSED",
          }
        });
      }
    }
  }
  console.log("✅ Loans generated.");

  // 6. Fixed Deposits
  console.log("\n🔒 Generating Fixed Deposits...");
  for (const branch of branches) {
    const branchEntities = allEntities.filter(e => e.branchId === branch.id).slice(0, 3);
    for (let i = 0; i < branchEntities.length; i++) {
        const entity = branchEntities[i];
        if (entity.type !== 'MEMBER') continue; // Schema has memberId mandatory
        
        const amount = 1000000;
        const accountNumber = `FIX-${branch.id.substring(0,3)}-${entity.id.substring(0,5)}`;
        const fd = await prisma.fixedDeposit.upsert({
          where: { accountNumber },
          update: {},
          create: {
            accountNumber,
            memberId: entity.id,
            branchId: branch.id,
            principalAmount: amount,
            interestRate: 12,
            termMonths: 12,
            startDate: new Date(),
            maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            maturityAmount: amount * 1.12,
            status: "ACTIVE"
          }
        });

        if (i === 0 && fd.status !== "WITHDRAWN") {
            await prisma.fixedDeposit.update({
                where: { id: fd.id },
                data: {
                    isWithdrawn: true,
                    withdrawnDate: new Date(),
                    withdrawnAmount: amount,
                    status: "WITHDRAWN"
                }
            });
        }
    }
  }
  console.log("✅ Fixed Deposits generated.");

  // 7. Shares
  console.log("\n📈 Generating Shares...");
  const sharesS = [ordinarySharesType, affiliateSharesType, associateSharesType].filter(Boolean);
  for (const branch of branches) {
    const branchMembers = allMembers.filter(m => m.branchId === branch.id).slice(0, 3);
    for (let i = 0; i < branchMembers.length; i++) {
        const member = branchMembers[i];
        const sType = sharesS[i % sharesS.length];
        if (!sType) continue;
        
        const accountNumber = `SHR-${branch.id.substring(0,3)}-${member.id.substring(0,5)}`;
        const shareAccount = await prisma.shareAccount.upsert({
          where: { accountNumber },
          update: {},
          create: {
            accountNumber,
            memberId: member.id,
            accountTypeId: sType.id,
            branchId: branch.id,
            numberOfShares: 10,
            shareValue: 10000,
            totalValue: 100000,
            status: "ACTIVE"
          }
        });

        const existingTx = await prisma.shareTransaction.findFirst({ where: { accountId: shareAccount.id } });
        if (!existingTx) {
            await prisma.shareTransaction.create({
              data: {
                accountId: shareAccount.id,
                transactionType: "PURCHASE",
                shares: 10,
                shareValue: 10000,
                amount: 100000,
                sharesBefore: 0,
                sharesAfter: 10,
                transactionDate: new Date(),
              }
            });
        }
    }
  }
  console.log("✅ Shares generated.");

  // 8. Compulsory Deposits
  console.log("\n📅 Generating Compulsory Deposits...");
  for (const m of allMembers) {
    if (m.compulsoryAccountId) {
        const branchStaff = staff.find(s => s.branchId === m.branchId);
        if (!branchStaff) continue;
        const amount = 50000;
        
        await prisma.transaction.create({
            data: {
                transactionRef: `COMP-${m.id.substring(0,5)}-${Date.now()}`,
                accountId: m.compulsoryAccountId,
                type: "DEPOSIT",
                amount: amount,
                status: "COMPLETED",
                processedByUserId: branchStaff.tellerId,
                branchId: m.branchId,
                memberId: m.id
            }
        });

        await prisma.account.update({
            where: { id: m.compulsoryAccountId },
            data: { balance: { increment: amount } }
        });
    }
  }
  console.log("✅ Compulsory deposits generated.");

  // 9. Income & Expenditure
  console.log("\n📄 Generating Income/Expenditure...");
  const incomeCats = await prisma.incomeCategory.findMany({ take: 5 });
  const expCats = await prisma.expenditureCategory.findMany({ take: 5 });

  for (const branch of branches) {
    const branchStaff = staff.find(s => s.branchId === branch.id);
    if (!branchStaff) continue;

    for (let i = 1; i <= 10; i++) {
        const incCat = incomeCats[i % incomeCats.length];
        if (!incCat) continue;
        
        const description = `Test Income ${i}`;
        const existingInc = await prisma.incomeRecord.findFirst({ where: { description, branchId: branch.id } });
        if (!existingInc) {
            await prisma.incomeRecord.create({
                data: {
                    amount: 50000 + (i * 10000),
                    categoryId: incCat.id,
                    description,
                    branchId: branch.id,
                    receivedByUserId: branchStaff.tellerId,
                    status: "COMPLETED"
                }
            });
        }

        const expCat = expCats[i % expCats.length];
        if (!expCat) continue;
        const expDesc = `Test Expenditure ${i}`;
        const existingExp = await prisma.expenditureRecord.findFirst({ where: { description: expDesc, branchId: branch.id } });
        if (!existingExp) {
            await prisma.expenditureRecord.create({
                data: {
                    amount: 20000 + (i * 5000),
                    categoryId: expCat.id,
                    description: expDesc,
                    branchId: branch.id,
                    submittedByUserId: branchStaff.tellerId,
                    status: "COMPLETED"
                }
            });
        }
    }
  }
  console.log("✅ Income & Expenditure records generated.");

  // 10. Assets
  console.log("\n🚜 Generating Assets...");
  for (const branch of branches) {
    const branchStaff = staff.find(s => s.branchId === branch.id);
    if (!branchStaff) continue;

    for (let i = 1; i <= 5; i++) {
        const assetCode = `AST-${branch.id.substring(0,3)}-${i}`;
        await prisma.fixedAsset.upsert({
            where: { assetCode },
            update: {},
            create: {
                assetCode,
                assetName: `Test Asset ${i}`,
                category: "EQUIPMENT",
                purchaseDate: new Date(),
                purchasePrice: 1000000 * i,
                depreciationRate: 10,
                usefulLifeYears: 10,
                currentValue: 1000000 * i,
                branchId: branch.id,
                status: "ACTIVE"
            }
        });
    }
  }
  console.log("✅ Assets generated.");

  console.log("\n🎉 E2E Seed Testing COMPLETE!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
