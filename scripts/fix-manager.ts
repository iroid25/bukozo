import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  try {
    const email = "manager@sacco.ug";
    const password = "password123";
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if branch exists for the user
    let branch = await prisma.branch.findFirst({
        where: { name: { contains: "Main" } }
    });
    
    if (!branch) {
        console.log("Creating Main Branch...");
        branch = await prisma.branch.create({
            data: {
                name: "Main Branch - Kampala",
                location: "Kampala Central",
                contactPerson: "System Admin",
                contactPhone: "+256700000000",
                email: "main@sacco.ug"
            }
        });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      console.log(`User ${email} exists. Updating role and password...`);
      await prisma.user.update({
        where: { email },
        data: {
          role: "BRANCHMANAGER",
          password: hashedPassword,
          branchId: branch.id,
          isActive: true, // Ensure active
          isVerified: true // Ensure verified
        },
      });
      console.log("Updated successfully.");
    } else {
      console.log(`User ${email} does not exist. Creating...`);
      await prisma.user.create({
        data: {
          email,
          name: "Manager User",
          firstName: "Manager",
          lastName: "User",
          password: hashedPassword,
          role: "BRANCHMANAGER",
          branchId: branch.id,
          phone: "+256700000002",
          isActive: true,
          isVerified: true,
        },
      });
      console.log("Created successfully.");
    }

    // Also fix Admin just in case
    console.log("Verifying Admin...");
    const adminEmail = "admin@sacco.ug";
    const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (adminUser) {
        await prisma.user.update({
            where: { email: adminEmail },
            data: {
                role: "ADMIN",
                password: hashedPassword, // Reset admin password too for convenience
                isActive: true,
                isVerified: true
            }
        });
        console.log("Admin updated.");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
