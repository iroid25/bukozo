// app/api/v1/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/prisma/db";
import bcrypt from "bcryptjs";
import { Gender, UserRole } from "@prisma/client";
import { getAuthUser } from "@/config/useAuth";
import { z } from "zod";
import { notifyBranchManagersAboutNewUser } from "@/actions/notification";
import { Resend } from "resend";
import WelcomeEmail from "@/components/email-templates/member-welcome";
import { EMAIL_FROM } from "@/lib/email";
import { findFingerprintConflict } from "@/lib/fingerprint-uniqueness";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import {
  insertFingerprintLog,
  loadFingerprintMemberRow,
  updateMemberFingerprintMetadata,
} from "@/lib/fingerprint-db";
import {
  isAtLeast18YearsOld,
  parseDateOfBirth,
} from "@/lib/date-of-birth";
import { isValidNin, normalizeNin } from "@/lib/identity";
import {
  getMemberNinPrefix,
  isMemberNinPrefixValid,
  normalizeMemberNin,
} from "@/lib/member-nin";
import {
  compareAuditTrailRows,
  recordCustomerAuditTrail,
} from "@/lib/customer-audit-trail";

const resend = new Resend(process.env.RESEND_API_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

// Validation Schema
const CreateUserSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address").optional().nullable(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  registrationDate: z.string().optional().nullable(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  nationalId: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  idCard: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  jobTitle: z.string().optional().nullable(),
  areaOfOperation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  parish: z.string().optional().nullable(),
  subCounty: z.string().optional().nullable(),
  constituency: z.string().optional().nullable(),
  postalAddress: z.string().optional().nullable(),
  nokName: z.string().optional().nullable(),
  nokRelationship: z.string().optional().nullable(),
  nokPhone: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  role: z.nativeEnum(UserRole),
  branchId: z.string().min(1, "Branch is required"),
  name: z.string().optional(),
  fingerprintTemplate: z.string().optional().nullable(),
  fingerprintQuality: z.number().int().min(0).max(100).optional().nullable(),
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone must be provided",
  path: ["email"],
});

const UpdateUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .optional(),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  registrationDate: z.string().optional().nullable(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  nationalId: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  idCard: z
    .string()
    .optional()
    .nullable()
    .transform((value) => normalizeNin(value))
    .refine((value) => value === null || isValidNin(value), {
      message: "NIN must start with CM or CF and be 14 characters long",
    }),
  jobTitle: z.string().optional().nullable(),
  areaOfOperation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  parish: z.string().optional().nullable(),
  subCounty: z.string().optional().nullable(),
  constituency: z.string().optional().nullable(),
  postalAddress: z.string().optional().nullable(),
  nokName: z.string().optional().nullable(),
  nokRelationship: z.string().optional().nullable(),
  nokPhone: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  role: z.nativeEnum(UserRole).optional(),
  fingerprintTemplate: z.string().optional().nullable(),
  fingerprintQuality: z.number().int().min(0).max(100).optional().nullable(),
});

/**
 * GET /api/v1/users - Get all users with filters
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const branchId = searchParams.get("branchId");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    // Build where clause
    const where: any = {};

    if (roleParam) {
      if (roleParam.includes(",")) {
        where.role = {
          in: roleParam.split(",") as UserRole[],
        };
      } else {
        where.role = roleParam as UserRole;
      }
    }

    if (currentUser.role !== UserRole.ADMIN && currentUser.branchId) {
      where.branchId = currentUser.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await db.user.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        isActive: true,
        isVerified: true,
        areaOfOperation: true,
        jobTitle: true,
        createdAt: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        member: {
          select: {
            id: true,
            memberNumber: true,
            isApproved: true,
            registrationDate: true,
            approvalDate: true,
            nin: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: users,
        count: users.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/users - Create a new user and send welcome email
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.DATA_ENTRANT,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to create users" },
        { status: 403 },
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = CreateUserSchema.parse(body);
    const warnings: string[] = [];
    const cleanFingerprintTemplate = normalizeFingerprintTemplate(
      validatedData.fingerprintTemplate,
    );
    const fingerprintQuality =
      typeof validatedData.fingerprintQuality === "number"
        ? Math.max(
            0,
            Math.min(100, Math.round(validatedData.fingerprintQuality)),
          )
        : null;

    if (validatedData.role === UserRole.MEMBER && !cleanFingerprintTemplate) {
      return NextResponse.json(
        { error: "Fingerprint enrollment is required for new members." },
        { status: 400 },
      );
    }

    // Validate SG400 native template size before any DB write
    if (cleanFingerprintTemplate) {
      const tplBytes = Buffer.from(cleanFingerprintTemplate, "base64").length;
      if (tplBytes !== 400) {
        return NextResponse.json(
          { error: `Invalid fingerprint template: ${tplBytes} bytes (expected 400). Start the bridge and re-enroll.`, templateBytes: tplBytes },
          { status: 422 },
        );
      }
    }

    if (validatedData.role === UserRole.MEMBER && cleanFingerprintTemplate) {
      let conflict;
      try {
        conflict = await findFingerprintConflict(cleanFingerprintTemplate);
      } catch {
        console.warn(
          "Fingerprint uniqueness check skipped because the bridge is unavailable.",
        );
        warnings.push(
          "Fingerprint uniqueness could not be verified because the bridge is not running.",
        );
      }
      if (conflict) {
        return NextResponse.json(
          {
            error: `This fingerprint is already enrolled to ${conflict.user?.name || "another member"} (${conflict.memberNumber}).`,
          },
          { status: 409 },
        );
      }
    }

    // Check if email already exists
    if (validatedData.email) {
      const existingEmail = await db.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingEmail) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 },
        );
      }
    }

    // Check if phone already exists (if provided)
    if (validatedData.phone) {
      const existingPhone = await db.user.findUnique({
        where: { phone: validatedData.phone },
      });

      if (existingPhone) {
        return NextResponse.json(
          { error: "A user with this phone number already exists" },
          { status: 400 },
        );
      }
    }

    // âœ… Store plain password before hashing (for email only)
    const parsedDateOfBirth = parseDateOfBirth(validatedData.dateOfBirth);
    if (!parsedDateOfBirth) {
      return NextResponse.json(
        { error: "Date of birth is required and must be valid" },
        { status: 400 },
      );
    }

    if (!isAtLeast18YearsOld(parsedDateOfBirth)) {
      return NextResponse.json(
        { error: "User must be at least 18 years old" },
        { status: 400 },
      );
    }

    const memberGender = validatedData.gender ?? null;
    const parsedRegistrationDate = validatedData.registrationDate
      ? new Date(validatedData.registrationDate)
      : new Date();
    if (Number.isNaN(parsedRegistrationDate.getTime())) {
      return NextResponse.json(
        { error: "Registration date must be a valid date" },
        { status: 400 },
      );
    }

    // Check if nationalId already exists (if provided)
    const memberNin = normalizeMemberNin(
      validatedData.idCard || validatedData.nationalId,
    );

    if (validatedData.role === UserRole.MEMBER && !memberGender) {
      return NextResponse.json(
        { error: "Gender is required for new members." },
        { status: 400 },
      );
    }

    const expectedMemberPrefix = getMemberNinPrefix(
      parsedDateOfBirth,
      memberGender,
    );

    if (validatedData.role === UserRole.MEMBER && !expectedMemberPrefix) {
      return NextResponse.json(
        {
          error:
            "Gender must be Male or Female for members so the NIN prefix can be generated.",
        },
        { status: 400 },
      );
    }

    if (validatedData.role === UserRole.MEMBER && !memberNin) {
      return NextResponse.json(
        { error: "NIN / ID Card is required for new members." },
        { status: 400 },
      );
    }

    if (
      validatedData.role === UserRole.MEMBER &&
      memberNin &&
      !isMemberNinPrefixValid(memberNin, parsedDateOfBirth, memberGender)
    ) {
      return NextResponse.json(
        {
          error: `Member NIN must start with ${expectedMemberPrefix} for the selected gender and date of birth.`,
        },
        { status: 400 },
      );
    }

    if (memberNin) {
      const existingNationalId = await db.user.findUnique({
        where: { nationalId: memberNin },
      });

      if (existingNationalId) {
        return NextResponse.json(
          { error: "A user with this National ID already exists" },
          { status: 400 },
        );
      }
    }

    const plainPassword = validatedData.password;

    // Hash password for database
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // âœ… Create user with auto-approval
    const newUser = await db.user.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        name:
          validatedData.name ||
          `${validatedData.firstName} ${validatedData.lastName}`,
        email: validatedData.email || null,
        phone: validatedData.phone,
        dateOfBirth: parsedDateOfBirth,
        nationalId: memberNin,
        password: hashedPassword,
        jobTitle: validatedData.jobTitle,
        areaOfOperation: validatedData.areaOfOperation,
        address: validatedData.address,
        image: validatedData.image,
        role: validatedData.role,
        branchId: validatedData.branchId,
        isActive: true, // âœ… Auto-approved
        isVerified: true, // âœ… Auto-verified
      },
      include: {
        branch: true,
      },
    });

    // âœ… Create member record with auto-approval
    let memberNumber = "N/A";
    if (newUser.role === UserRole.MEMBER) {
      const memberCount = await db.member.count();
      memberNumber = `MEM${String(memberCount + 1).padStart(6, "0")}`;

      const createdMember = await db.member.create({
        data: {
          userId: newUser.id,
          memberNumber: memberNumber,
          isApproved: true, // âœ… Auto-approved when fingerprint is enrolled
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          approvedByUserId: currentUser.id,
          approvalDate: new Date(), // legacy approval timestamp field
          registrationDate: parsedRegistrationDate,
          nin: memberNin,
          gender: memberGender ?? undefined,
          typeOfId: memberNin ? "National Identity Card" : null,
          additionalDocs: [],
          fingerprintTemplate: cleanFingerprintTemplate,
          village: validatedData.village || null,
          parish: validatedData.parish || null,
          subCounty: validatedData.subCounty || null,
          constituency: validatedData.constituency || null,
          district: validatedData.district || "Kasese",
          postalAddress: validatedData.postalAddress || null,
          nokName: validatedData.nokName || null,
          nokRelationship: validatedData.nokRelationship || null,
          nokPhone: validatedData.nokPhone || null,
        },
      });

      if (cleanFingerprintTemplate) {
        await updateMemberFingerprintMetadata({
          memberId: createdMember.id,
          template: cleanFingerprintTemplate,
          quality: fingerprintQuality,
        });
        await insertFingerprintLog({
          memberId: createdMember.id,
          action: "ENROLL",
          quality: fingerprintQuality,
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "",
        });
      }

      try {
        const branch = newUser.branchId
          ? await db.branch.findUnique({
              where: { id: newUser.branchId },
              select: { id: true, name: true },
            })
          : null;

        const afterSnapshot = {
          member: {
            id: createdMember.id,
            memberNumber: createdMember.memberNumber,
            registrationDate: createdMember.registrationDate,
            gender: createdMember.gender,
            nin: createdMember.nin,
            village: createdMember.village,
            parish: createdMember.parish,
            subCounty: createdMember.subCounty,
            constituency: createdMember.constituency,
            town: createdMember.town,
            district: createdMember.district,
            otherNames: createdMember.otherNames,
          },
          user: {
            id: newUser.id,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            name: newUser.name,
            email: newUser.email,
            phone: newUser.phone,
            dateOfBirth: newUser.dateOfBirth,
            address: newUser.address,
            nationalId: newUser.nationalId,
            branchId: newUser.branchId,
          },
        };

        await recordCustomerAuditTrail({
          actionType: "Created",
          customerId: createdMember.id,
          before: {} as any,
          after: afterSnapshot as any,
          changedBy: currentUser.name,
          changedByUserId: currentUser.id,
          branch,
        });
      } catch (auditError) {
        console.error("Error creating customer audit trail:", auditError);
      }
    }

    // âœ… Send welcome email with login credentials
    if (newUser.email) {
      try {
        const loginUrl = `${baseUrl}/login`;


        const { data: emailData, error: emailError } = await resend.emails.send(
          {
            from: EMAIL_FROM,
            to: newUser.email,
            subject: "Welcome to Bukonzo Teachers SACCO - Account Created",
            react: WelcomeEmail({
              memberName: newUser.name,
              memberNumber: memberNumber,
              email: newUser.email,
              password: plainPassword, // Send plain password in email
              loginUrl: loginUrl,
            }),
          },
        );

        if (emailError) {
          console.error("âŒ Failed to send welcome email:", emailError);
          // Don't fail user creation if email fails
        } else {
        }
      } catch (emailErr) {
        console.error("âŒ Error sending welcome email:", emailErr);
      }
    } else {
    }
    // Don't fail user creation if email fails

    // Notify branch managers about new user
    try {
      await notifyBranchManagersAboutNewUser(
        newUser.id,
        newUser.name,
        newUser.role,
      );
    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
    }

    // Create audit log
    try {
      const currentUser = await getAuthUser();
      if (currentUser) {
        await db.auditLog.create({
          data: {
            userId: currentUser.id,
            action: "USER_CREATED",
            entityType: "User",
            entityId: newUser.id,
            details: `Created new ${newUser.role.toLowerCase()}: ${
              newUser.name
            } (${newUser.email})`,
          },
        });
      }
    } catch (auditError) {
      console.error("Error creating audit log:", auditError);
    }

    return NextResponse.json(
      {
        message:
          "User created successfully! Welcome email sent with login credentials.",
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
          memberNumber: memberNumber,
        },
        warnings,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid data provided",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to create user. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/users - Update an existing user
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = UpdateUserSchema.parse(body);
    const cleanFingerprintTemplate = normalizeFingerprintTemplate(
      validatedData.fingerprintTemplate,
    );
    const fingerprintQuality =
      typeof validatedData.fingerprintQuality === "number"
        ? Math.max(
            0,
            Math.min(100, Math.round(validatedData.fingerprintQuality)),
          )
        : null;

    // Check permissions
    const isOwnProfile = currentUser.id === validatedData.userId;
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.ACCOUNTANT,
      UserRole.DATA_ENTRANT,
    ];
    const hasPermission =
      isOwnProfile || allowedRoles.includes(currentUser.role as UserRole);

    if (!hasPermission) {
      return NextResponse.json(
        { error: "You don't have permission to update this user" },
        { status: 403 },
      );
    }

    // Get existing user
    const existingUser = await db.user.findUnique({
      where: { id: validatedData.userId },
      include: {
        member: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      existingUser.member &&
      !existingUser.member.fingerprintTemplate &&
      !cleanFingerprintTemplate
    ) {
      return NextResponse.json(
        {
          error:
            "Fingerprint enrollment is required before updating this member.",
        },
        { status: 400 },
      );
    }

    if (
      validatedData.fingerprintTemplate !== undefined &&
      validatedData.fingerprintTemplate !== null &&
      !cleanFingerprintTemplate
    ) {
      return NextResponse.json(
        { error: "Fingerprint template cannot be empty." },
        { status: 400 },
      );
    }

    // Validate SG400 native template size before any DB write
    if (cleanFingerprintTemplate) {
      const tplBytes = Buffer.from(cleanFingerprintTemplate, "base64").length;
      if (tplBytes !== 400) {
        return NextResponse.json(
          { error: `Invalid fingerprint template: ${tplBytes} bytes (expected 400). Start the bridge and re-enroll.`, templateBytes: tplBytes },
          { status: 422 },
        );
      }
    }

    // Check if email is being changed and if it's already taken
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await db.user.findFirst({
        where: {
          email: validatedData.email,
          NOT: { id: validatedData.userId },
        },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "Email address is already in use" },
          { status: 400 },
        );
      }
    }

    // Check if phone is being changed and if it's already taken
    if (validatedData.phone && validatedData.phone !== existingUser.phone) {
      const phoneExists = await db.user.findFirst({
        where: {
          phone: validatedData.phone,
          NOT: { id: validatedData.userId },
        },
      });

      if (phoneExists) {
        return NextResponse.json(
          { error: "Phone number is already in use" },
          { status: 400 },
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };
    const memberUpdateData: any = {};
    const normalizeOptionalString = (value?: string | null) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    if (validatedData.firstName) updateData.firstName = validatedData.firstName;
    if (validatedData.lastName) updateData.lastName = validatedData.lastName;
    if (validatedData.firstName || validatedData.lastName) {
      const fName = validatedData.firstName || existingUser.firstName;
      const lName = validatedData.lastName || existingUser.lastName;
      updateData.name = `${fName} ${lName}`.trim();
    }
    const nextEmail = normalizeOptionalString(validatedData.email);
    if (nextEmail) updateData.email = nextEmail;
    if (validatedData.phone !== undefined)
      updateData.phone = validatedData.phone;
    const nextJobTitle = normalizeOptionalString(validatedData.jobTitle);
    if (nextJobTitle !== undefined) updateData.jobTitle = nextJobTitle;
    if (validatedData.image !== undefined)
      updateData.image = validatedData.image;
    if (validatedData.address !== undefined) {
      const nextAddress = normalizeOptionalString(validatedData.address);
      if (nextAddress !== undefined) updateData.address = nextAddress;
    }
    if (validatedData.district !== undefined && existingUser.member) {
      const nextDistrict = normalizeOptionalString(validatedData.district);
      if (nextDistrict !== undefined) {
        memberUpdateData.district = nextDistrict;
      }
    }
    if (validatedData.areaOfOperation !== undefined) {
      const nextAreaOfOperation = normalizeOptionalString(
        validatedData.areaOfOperation,
      );
      if (nextAreaOfOperation !== undefined) {
        updateData.areaOfOperation = nextAreaOfOperation;
      }
    }

    let nextDateOfBirth: Date | null = existingUser.dateOfBirth ?? null;

    // Add optional fields
    if (validatedData.dateOfBirth !== undefined && validatedData.dateOfBirth !== null) {
      const parsedDateOfBirth = parseDateOfBirth(validatedData.dateOfBirth);
      if (!parsedDateOfBirth) {
        return NextResponse.json(
          { error: "Date of birth must be a valid date" },
          { status: 400 },
        );
      }

      if (!isAtLeast18YearsOld(parsedDateOfBirth)) {
        return NextResponse.json(
          { error: "User must be at least 18 years old" },
          { status: 400 },
        );
      }

      updateData.dateOfBirth = parsedDateOfBirth;
      nextDateOfBirth = parsedDateOfBirth;
    } else if (!existingUser.dateOfBirth) {
      return NextResponse.json(
        { error: "Date of birth is required" },
        { status: 400 },
      );
    }
    const nextNationalId =
      normalizeMemberNin(validatedData.idCard) ||
      normalizeMemberNin(validatedData.nationalId);
    const nextGender =
      validatedData.gender !== undefined
        ? validatedData.gender
        : existingUser.member?.gender ?? null;

    if (existingUser.member && validatedData.gender === null) {
      return NextResponse.json(
        { error: "Gender is required for members" },
        { status: 400 },
      );
    }

    if (existingUser.member && !nextGender) {
      return NextResponse.json(
        { error: "Gender is required for members" },
        { status: 400 },
      );
    }

    if (
      existingUser.member &&
      validatedData.gender !== undefined &&
      validatedData.gender !== null
    ) {
      memberUpdateData.gender = validatedData.gender;
    }

    if (nextNationalId) {
      updateData.nationalId = nextNationalId;
      if (existingUser.member) {
        memberUpdateData.nin = nextNationalId;
      }
    }
    if (
      existingUser.member &&
      (nextNationalId || nextDateOfBirth || nextGender)
    ) {
      const effectiveMemberNin =
        nextNationalId || existingUser.member.nin || existingUser.nationalId || null;
      if (
        effectiveMemberNin &&
        !isMemberNinPrefixValid(effectiveMemberNin, nextDateOfBirth, nextGender)
      ) {
        const expectedPrefix = getMemberNinPrefix(nextDateOfBirth, nextGender);
        return NextResponse.json(
          {
            error: expectedPrefix
              ? `Member NIN must start with ${expectedPrefix} for the selected gender and date of birth.`
              : "Member NIN cannot be validated without a valid gender and date of birth.",
          },
          { status: 400 },
        );
      }
    }
    if (
      validatedData.registrationDate !== undefined &&
      validatedData.registrationDate !== null
    ) {
      if (!existingUser.member) {
        return NextResponse.json(
          { error: "Registration date can only be updated for members" },
          { status: 400 },
        );
      }

      const parsedRegistrationDate = new Date(validatedData.registrationDate);
      if (Number.isNaN(parsedRegistrationDate.getTime())) {
        return NextResponse.json(
          { error: "Registration date must be a valid date" },
          { status: 400 },
        );
      }
      memberUpdateData.registrationDate = parsedRegistrationDate;
    }
    if (validatedData.branchId !== undefined) {
      updateData.branchId = validatedData.branchId;
    }

    if (existingUser.member && validatedData.constituency !== undefined) {
      memberUpdateData.constituency = validatedData.constituency?.trim() || null;
    }
    if (existingUser.member && validatedData.village !== undefined) {
      memberUpdateData.village = validatedData.village?.trim() || null;
    }
    if (existingUser.member && validatedData.parish !== undefined) {
      memberUpdateData.parish = validatedData.parish?.trim() || null;
    }
    if (existingUser.member && validatedData.subCounty !== undefined) {
      memberUpdateData.subCounty = validatedData.subCounty?.trim() || null;
    }
    if (existingUser.member && validatedData.postalAddress !== undefined) {
      memberUpdateData.postalAddress = validatedData.postalAddress?.trim() || null;
    }
    if (existingUser.member && validatedData.nokName !== undefined) {
      memberUpdateData.nokName = validatedData.nokName?.trim() || null;
    }
    if (existingUser.member && validatedData.nokRelationship !== undefined) {
      memberUpdateData.nokRelationship = validatedData.nokRelationship?.trim() || null;
    }
    if (existingUser.member && validatedData.nokPhone !== undefined) {
      memberUpdateData.nokPhone = validatedData.nokPhone?.trim() || null;
    }

    if (validatedData.fingerprintTemplate !== undefined && validatedData.fingerprintTemplate !== null && existingUser.member) {
      const currentFingerprintRow = await loadFingerprintMemberRow(
        existingUser.member.id,
      );
      const nextFingerprintQuality =
        fingerprintQuality ?? currentFingerprintRow?.fingerprintQuality ?? null;

      const isFirstEnrollment = !existingUser.member.fingerprintTemplate;
      await db.member.update({
        where: { id: existingUser.member.id },
        data: {
          fingerprintTemplate: cleanFingerprintTemplate,
          // Approval metadata is only written on first enrollment.
          // Re-enrollment skips these fields entirely to avoid P2003 from
          // approvedByUserId pointing to a user that may have been deleted.
          ...(cleanFingerprintTemplate && isFirstEnrollment
            ? {
                isApproved: true,
                approvalStatus: "APPROVED",
                approvedAt: new Date(),
                approvedByUserId: currentUser.id,
                approvalDate: new Date(),
              }
            : {}),
        },
      });

      if (cleanFingerprintTemplate) {
        await updateMemberFingerprintMetadata({
          memberId: existingUser.member.id,
          template: cleanFingerprintTemplate,
          quality: nextFingerprintQuality,
        });
        await insertFingerprintLog({
          memberId: existingUser.member.id,
          action: "ENROLL",
          quality: nextFingerprintQuality,
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "",
        });
      }
    }

    if (existingUser.member && Object.keys(memberUpdateData).length > 0) {
      await db.member.update({
        where: { id: existingUser.member.id },
        data: memberUpdateData,
      });
    }

    // Only admins/managers can change active status and role
    if (allowedRoles.includes(currentUser.role as UserRole)) {
      if (validatedData.isActive !== undefined) {
        updateData.isActive = validatedData.isActive;
      }
      if (validatedData.role) {
        updateData.role = validatedData.role;
      }
    }

    // Update user
    const updatedUser = await db.user.update({
      where: { id: validatedData.userId },
      data: updateData,
      include: {
        branch: true,
        member: true,
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          userId: currentUser.id,
          action: "USER_UPDATED",
          entityType: "User",
          entityId: validatedData.userId,
          oldValue: existingUser as any,
          newValue: updatedUser as any,
          details: `Updated user: ${updatedUser.name} (${updatedUser.role})`,
        },
      });
    } catch (auditError) {
      console.error("Error creating audit log:", auditError);
    }

    if (existingUser.member) {
      try {
        const branch = currentUser.branchId
          ? await db.branch.findUnique({
              where: { id: currentUser.branchId },
              select: { id: true, name: true },
            })
          : null;

        const beforeSnapshot = {
          member: {
            id: existingUser.member.id,
            memberNumber: existingUser.member.memberNumber,
            registrationDate: existingUser.member.registrationDate,
            gender: existingUser.member.gender,
            nin: existingUser.member.nin,
            village: existingUser.member.village,
            parish: existingUser.member.parish,
            subCounty: existingUser.member.subCounty,
            constituency: existingUser.member.constituency,
            town: existingUser.member.town,
            district: existingUser.member.district,
            otherNames: existingUser.member.otherNames,
          },
          user: {
            id: existingUser.id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            dateOfBirth: existingUser.dateOfBirth,
            address: existingUser.address,
            nationalId: existingUser.nationalId,
            branchId: existingUser.branchId,
          },
        };

        const afterSnapshot = {
          member: {
            id: updatedUser.member?.id ?? existingUser.member.id,
            memberNumber:
              updatedUser.member?.memberNumber ?? existingUser.member.memberNumber,
            registrationDate:
              updatedUser.member?.registrationDate ??
              existingUser.member.registrationDate,
            gender: updatedUser.member?.gender ?? existingUser.member.gender,
            nin: updatedUser.member?.nin ?? existingUser.member.nin,
            village: updatedUser.member?.village ?? existingUser.member.village,
            parish: updatedUser.member?.parish ?? existingUser.member.parish,
            subCounty: updatedUser.member?.subCounty ?? existingUser.member.subCounty,
            constituency:
              updatedUser.member?.constituency ?? existingUser.member.constituency,
            town: updatedUser.member?.town ?? existingUser.member.town,
            district: updatedUser.member?.district ?? existingUser.member.district,
            otherNames:
              updatedUser.member?.otherNames ?? existingUser.member.otherNames,
          },
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            dateOfBirth: updatedUser.dateOfBirth,
            address: updatedUser.address,
            nationalId: updatedUser.nationalId,
            branchId: updatedUser.branchId,
          },
        };

        const changedFields = compareAuditTrailRows(
          beforeSnapshot as any,
          afterSnapshot as any,
        );

        if (changedFields.length > 0) {
          await recordCustomerAuditTrail({
            actionType: "Edited",
            customerId: existingUser.member.id,
            before: beforeSnapshot as any,
            after: afterSnapshot as any,
            changedBy: currentUser.name,
            changedByUserId: currentUser.id,
            branch,
          });
        }
      } catch (auditError) {
        console.error("Error creating customer audit trail:", auditError);
      }
    }

    return NextResponse.json(
      {
        message: "User updated successfully",
        data: updatedUser,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating user:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid data provided",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Failed to update user. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/users - Deactivate a user (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.DATA_ENTRANT,
    ];
    if (!allowedRoles.includes(currentUser.role as UserRole)) {
      return NextResponse.json(
        { error: "You don't have permission to delete users" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Deactivate user (soft delete)
    const deactivatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "USER_DEACTIVATED",
        entityType: "User",
        entityId: userId,
        details: `Deactivated user: ${user.name} (${user.email})`,
      },
    });

    return NextResponse.json(
      {
        message: "User deactivated successfully",
        data: deactivatedUser,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deactivating user:", error);
    return NextResponse.json(
      { error: "Failed to deactivate user" },
      { status: 500 },
    );
  }
}
