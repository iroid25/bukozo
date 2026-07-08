import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { UserCreateDTO } from "@/actions/members";
import { Prisma, UserRole } from "@prisma/client";
import { findFingerprintConflict } from "@/lib/fingerprint-uniqueness";
import { normalizeFingerprintTemplate } from "@/lib/fingerprint";
import { isValidNin, normalizeNin } from "@/lib/identity";

const resend = new Resend(process.env.RESEND_API_KEY!);

// Helper function to generate unique member number
async function generateMemberNumber(): Promise<string> {
  try {
    const currentYear = new Date().getFullYear();
    const memberCount = await db.member.count();
    const memberNumber = `${currentYear}${(memberCount + 1)
      .toString()
      .padStart(6, "0")}`;

    // Check for uniqueness
    const existingMember = await db.member.findUnique({
      where: { memberNumber },
    });

    if (existingMember) {
      const randomSuffix = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      return `${currentYear}${(memberCount + 1)
        .toString()
        .padStart(3, "0")}${randomSuffix}`;
    }

    return memberNumber;
  } catch (error) {
    console.error("Error generating member number:", error);
    return `MEM${Date.now()}`;
  }
}

// Helper function to send welcome email
async function sendWelcomeEmail({
  memberName,
  email,
  password,
  memberNumber,
}: {
  memberName: string;
  email: string;
  password: string;
  memberNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await resend.emails.send({
      from: " bukonzo Teachers SACCO <info@maripatechagency.com>", // Using your existing verified domain
      to: email,
      subject: "Welcome to  bukonzo Teachers SACCO",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;"> bukonzo Teachers SACCO</h1>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome ${memberName}!</h2>
            <p style="font-size: 16px; color: #555; line-height: 1.6;">
              Your member account has been created successfully. Here are your login details:
            </p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Member Number:</strong> ${memberNumber}</p>
              <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
            </div>
            <p style="font-size: 14px; color: #dc3545; margin-bottom: 20px;">
              <strong>Important:</strong> Please change your password after your first login for security purposes.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/login" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; padding: 12px 24px; text-decoration: none; 
                        border-radius: 6px; display: inline-block;">
                Login to Your Account
              </a>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <div style="text-align: center;">
              <p style="font-size: 14px; color: #888; margin: 0;">
                This email was sent from  bukonzo Teachers SACCO
              </p>
              <p style="font-size: 12px; color: #888; margin: 5px 0 0 0;">
                If you have any questions, please contact us at info@maripatechagency.com
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Welcome ${memberName}!\n\nYour member account has been created successfully.\n\nMember Number: ${memberNumber}\nEmail: ${email}\nTemporary Password: ${password}\n\nPlease change your password after your first login.\n\nLogin at: ${process.env.NEXT_PUBLIC_BASE_URL}/login\n\n---\nThis email was sent from  bukonzo Teachers SACCO`,
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
}

// GET /api/v1/members - Get approved members
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eligible = searchParams.get("eligible") === "true";
    const search = (searchParams.get("search") || "").trim();

    const userRole = (session.user as any).role;
    const userBranchId = (session.user as any).branchId;

    const escapeSql = (value: string) => value.replace(/'/g, "''");
    const branchFilter =
      userRole !== "ADMIN" && userBranchId
        ? `AND u."branchId" = '${escapeSql(userBranchId)}'`
        : "";
    const searchFilter = search
      ? `AND (
          m."memberNumber" ILIKE '%${escapeSql(search)}%' OR
          u."name" ILIKE '%${escapeSql(search)}%' OR
          u."email" ILIKE '%${escapeSql(search)}%' OR
          u."phone" ILIKE '%${escapeSql(search)}%'
        )`
      : "";
    const eligibleFilter = eligible
      ? `AND EXISTS (
          SELECT 1
          FROM "Account" a
          WHERE a."memberId" = m.id
            AND a.status = 'ACTIVE'
        )`
      : "";

    const members = await db.$queryRawUnsafe<any[]>(`
      SELECT
        m.id,
        m."userId",
        m."memberNumber",
        m."registrationDate",
        m."isApproved",
        m.surname,
        m."otherNames",
        m.occupation,
        m.nin,
        m."typeOfId",
        m.status,
        m."approvalStatus",
        m."approvedAt",
        m."approvedByUserId",
        m."fingerprintTemplate",
        m."createdAt",
        m."updatedAt",
        json_build_object(
          'id', u.id,
          'role', u.role,
          'name', u.name,
          'email', u.email,
          'phone', u.phone,
          'image', u.image,
          'branchId', u."branchId",
          'isActive', u."isActive",
          'createdAt', u."createdAt",
          'branch', CASE
            WHEN b.id IS NULL THEN NULL
            ELSE json_build_object(
              'id', b.id,
              'name', b.name,
              'location', b.location
            )
          END
        ) AS user
      FROM "Member" m
      JOIN "User" u ON u.id = m."userId"
      LEFT JOIN "Branch" b ON b.id = u."branchId"
      WHERE 1=1
        ${branchFilter}
        ${eligibleFilter}
        ${searchFilter}
      ORDER BY m."memberNumber" ASC
    `);

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const allowedRoles: UserRole[] = [
      UserRole.ADMIN,
      UserRole.BRANCHMANAGER,
      UserRole.DATA_ENTRANT,
      UserRole.ACCOUNT_OPENER,
    ];

    const currentRole = session.user.role as UserRole;
    if (!allowedRoles.includes(currentRole)) {
      return NextResponse.json(
        { error: "You don't have permission to create members" },
        { status: 403 },
      );
    }

    // Check if Account Opener role is active if the current user is an ACCOUNT_OPENER
    if (currentRole === UserRole.ACCOUNT_OPENER) {
      const staffLimit = await db.staffLimit.findUnique({
        where: { role: UserRole.ACCOUNT_OPENER },
      });

      if (!staffLimit || !staffLimit.isActive) {
        return NextResponse.json(
          {
            error:
              "Account Opening functionality is currently deactivated. Please contact your administrator.",
          },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const data = body as UserCreateDTO;
    const warnings: string[] = [];


    // Validate required fields
    if (!data.firstName || !data.lastName || !data.email || !data.password) {
      return NextResponse.json(
        { error: "First name, last name, email, and password are required" },
        { status: 400 },
      );
    }

    if ((data.role || "MEMBER") === "MEMBER" && !data.fingerprintTemplate) {
      return NextResponse.json(
        { error: "Fingerprint enrollment is required for new members." },
        { status: 400 },
      );
    }

    const memberNin = normalizeNin(data.idCard || data.nationalId);
    if ((data.role || "MEMBER") === "MEMBER" && !memberNin) {
      return NextResponse.json(
        { error: "NIN / ID Card is required for new members." },
        { status: 400 },
      );
    }
    if (memberNin && !isValidNin(memberNin)) {
      return NextResponse.json(
        {
          error: "NIN must start with CM or CF and be 14 characters long.",
        },
        { status: 400 },
      );
    }

    if (data.fingerprintTemplate) {
      const cleanTemplate = normalizeFingerprintTemplate(data.fingerprintTemplate);
      const tplBytes = cleanTemplate ? Buffer.from(cleanTemplate, "base64").length : 0;
      if (!cleanTemplate || tplBytes !== 400) {
        return NextResponse.json(
          { error: `Invalid fingerprint template: ${tplBytes} bytes (expected 400). Start the bridge and re-enroll.`, templateBytes: tplBytes },
          { status: 422 },
        );
      }

      let conflict;
      try {
        conflict = await findFingerprintConflict(cleanTemplate);
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

    // Check if user with email already exists
    const existingUserByEmail = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Check if phone number already exists (if provided)
    if (data.phone) {
      const existingUserByPhone = await db.user.findUnique({
        where: { phone: data.phone },
      });

      if (existingUserByPhone) {
        return NextResponse.json(
          { error: "User with this phone number already exists" },
          { status: 409 },
        );
      }
    }

    // Check if national ID already exists (if provided)
    if (data.nationalId) {
      const existingUserByNationalId = await db.user.findUnique({
        where: { nationalId: data.nationalId },
      });

      if (existingUserByNationalId) {
        return NextResponse.json(
          { error: "User with this national ID already exists" },
          { status: 409 },
        );
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Prepare user data
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      name: data.name || `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      password: hashedPassword,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      nationalId: memberNin,
      jobTitle: data.jobTitle || null,
      areaOfOperation: data.areaOfOperation || null,
      address: data.postalAddress || data.village || null,
      role: (data.role || "MEMBER") as UserRole,
      branchId: data.branchId || null,
      image: data.image || null,
      isActive: true,
      isVerified: true,
    };

    // Create user in database
    const newUser = await db.user.create({
      data: userData,
    });

    // If user is a MEMBER, create Member record and send welcome email
    if (userData.role === "MEMBER") {
      try {
        // Generate unique member number
        const memberNumber = await generateMemberNumber();
        const parsedRegistrationDate = data.registrationDate
          ? new Date(data.registrationDate)
          : new Date();

        // Create Member record
        const newMember = await db.member.create({
          data: {
            userId: newUser.id,
            memberNumber,
            registrationDate: Number.isNaN(parsedRegistrationDate.getTime())
              ? new Date()
              : parsedRegistrationDate,
            nin: memberNin || "",
            surname: data.firstName,
            otherNames: data.lastName,
            typeOfId: memberNin ? "National Identity Card" : null,
            additionalDocs: [],
            occupation: data.jobTitle,
            village: data.village || null,
            parish: data.parish || null,
            subCounty: data.subCounty || null,
            postalAddress: data.postalAddress || null,
            nokName: data.nokName || null,
            nokRelationship: data.nokRelationship || null,
            nokPhone: data.nokPhone || null,
            approvalStatus: "PENDING", // Requires admin approval
          },
        });

        // Send welcome email
        const emailResult = await sendWelcomeEmail({
          memberName: newUser.name,
          email: newUser.email!,
          password: data.password, // Send the plain password in email
          memberNumber: newMember.memberNumber,
        });

        if (!emailResult.success) {
          console.warn(
            "User created but welcome email failed:",
            emailResult.error,
          );
        }

        // Send in-app welcome notification
        try {
          await db.notification.create({
            data: {
              userId: newUser.id,
              type: "IN_APP",
              subject: "Welcome to Bukonzo Teachers SACCO!",
              message: `Your membership registration is complete. Member Number: ${newMember.memberNumber}. Your account is pending admin approval. You will be notified once approved.`,
              targetAddress: "/dashboard",
              status: "PENDING",
            },
          });
        } catch (notifError) {
          console.error("Welcome notification error:", notifError);
        }

        // Return structured data similar to what frontend might expect
        return NextResponse.json(
          {
            user: newUser,
            member: newMember,
            message: "Member created successfully",
            warnings,
          },
          { status: 201 },
        );
      } catch (error) {
        // If member creation fails, we should clean up the user
        await db.user.delete({ where: { id: newUser.id } });
        console.error("Error creating member record:", error);
        return NextResponse.json(
          {
            error: "Failed to complete member registration. Please try again.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { user: newUser, message: "User created successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user. Please try again." },
      { status: 500 },
    );
  }
}
