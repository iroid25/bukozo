
import { NextResponse } from "next/server";
import { db } from "@/prisma/db";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/config/useAuth";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login.", data: null },
        { status: 401 }
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [UserRole.ADMIN, UserRole.BRANCHMANAGER, UserRole.DATA_ENTRANT];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to register institutions", data: null },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!data.institutionName || !data.institutionType) {
      return NextResponse.json(
        { error: "Institution name and type are required", data: null },
        { status: 400 }
      );
    }

    if (!data.institutionEmail || !data.institutionPhone) {
      return NextResponse.json(
        { error: "Institution email and phone are required", data: null },
        { status: 400 }
      );
    }

    if (!data.primaryContactPerson || !data.primaryContactPhone) {
      return NextResponse.json(
        { error: "Primary contact person and phone are required", data: null },
        { status: 400 }
      );
    }

    if (!data.branchId) {
      return NextResponse.json(
        { error: "Branch selection is required", data: null },
        { status: 400 }
      );
    }

    const normalizedEmail = String(data.institutionEmail || "").trim().toLowerCase();
    const normalizedPhone = String(data.institutionPhone || "").trim();
    const normalizedContactPhone = String(data.primaryContactPhone || "").trim();
    const normalizedBranchId =
      currentUser.role === UserRole.ADMIN
        ? String(data.branchId || "").trim()
        : String(currentUser.branchId || "").trim();

    if (!normalizedBranchId) {
      return NextResponse.json(
        { error: "You are not assigned to a branch. Contact administrator.", data: null },
        { status: 403 }
      );
    }

    const branchExists = await db.branch.findUnique({
      where: { id: normalizedBranchId },
      select: { id: true },
    });

    if (!branchExists) {
      return NextResponse.json(
        { error: "Selected branch was not found", data: null },
        { status: 404 }
      );
    }

    if (!data.password || !String(data.password).trim()) {
      return NextResponse.json(
        { error: "Password is required", data: null },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email address is already registered", data: null },
        { status: 409 }
      );
    }

    // Check if phone already exists
    if (normalizedPhone) {
      const existingPhone = await db.user.findUnique({
        where: { phone: normalizedPhone },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: "Phone number is already registered", data: null },
          { status: 409 }
        );
      }
    }

    // Verify user exists in DB to prevent FK errors
    const dbUser = await db.user.findUnique({ where: { id: currentUser.id } });
    if (!dbUser) {
        return NextResponse.json(
            { error: "Invalid session. Please logout and login again.", data: null },
            { status: 401 }
        );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(String(data.password), 10);

    // Generate institution number
    const institutionCount = await db.institution.count();
    const institutionNumber = `INST${String(institutionCount + 1).padStart(6, "0")}`;

    // Create user and institution in a transaction
    const result = await db.$transaction(async (tx) => {
      const administrators = Array.isArray(data.administrators)
        ? data.administrators
        : [];

      // ... (rest of the creation logic remains similar but safe) ...
      // Create User
      const user = await tx.user.create({
        data: {
          firstName: data.institutionName,
          lastName: data.institutionType,
          name: data.institutionName,
          email: normalizedEmail,
          phone: normalizedPhone,
          password: hashedPassword,
          role: UserRole.INSTITUTION,
          branchId: normalizedBranchId,
          isActive: false,
          isVerified: false,
          requiresPasswordChange: true,
        },
      });

      // Create Institution
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
          primaryContactPhone: normalizedContactPhone,
          primaryContactEmail: data.primaryContactEmail,
          institutionPhone: normalizedPhone,
          institutionEmail: normalizedEmail,
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

      // Create Signatories
      const validAdmins = administrators.filter((a: any) => a.name && a.post);
      if (validAdmins.length > 0) {
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
                }
             });
        }
      }

      // Create audit log - Let this fail if it must, so we know there is an issue
      await tx.auditLog.create({
          data: {
          userId: currentUser.id,
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

      return { user, institution };
    });

    // Revalidate the institutions list page
    revalidatePath("/dashboard/users/institution");
    revalidatePath("/dashboard/users/institutions"); // Just in case of typo/legacy path
    revalidatePath("/dashboard");

    return NextResponse.json({ error: null, data: result });
  } catch (error) {
    console.error("API Error creating institution:", error);
    if (error instanceof Error) {
      console.error("Institution create failure details:", error.message);
    }

    return NextResponse.json(
      { error: "Failed to register institution. Please try again.", data: null },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/config/auth");
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please login.", data: [] },
        { status: 401 }
      );
    }

    const currentUser = session.user as any;

    // Build where clause based on role
    let whereClause: any = {};

    if (currentUser.role === UserRole.ADMIN) {
      // ADMIN sees all institutions
      whereClause = {};
    } else {
      // Non-ADMIN users only see institutions in their branch
      if (!currentUser.branchId) {
        return NextResponse.json(
          { error: "You are not assigned to any branch. Contact administrator.", data: [] },
          { status: 403 }
        );
      }

      whereClause = {
        user: {
          branchId: currentUser.branchId,
        },
      };
    }

    const institutions = await db.institution.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
            role: true,
            createdAt: true,
            branchId: true,
            branch: {
              select: {
                name: true,
              },
            },
          },
        },
        signatories: {
          select: {
            id: true,
            name: true,
            title: true,
            phone: true,
            email: true,
            signatureImage: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ error: null, data: institutions });
  } catch (error) {
    console.error("API Error fetching institutions:", error);
    return NextResponse.json(
      { error: "Failed to fetch institutions", data: [] },
      { status: 500 }
    );
  }
}
