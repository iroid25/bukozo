import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/config/auth";
import { db } from "@/prisma/db";
import { resolveAuthenticatedUser } from "@/lib/auth-user";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const authenticatedUser = await resolveAuthenticatedUser({
      id: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
    });

    if (!authenticatedUser) {
      return NextResponse.json(
        { error: "Authenticated user record not found." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { 
      email, nin, surname, otherNames, dateOfBirth, 
      gender, maritalStatus, occupation, citizenship, 
      address, phone, nokName, nokRelationship, nokPhone 
    } = body;

    // Validation
    const errors: { [key: string]: string[] } = {};
    if (!email || !email.includes("@")) errors.email = ["Invalid email address."];
    if (!nin || nin.length < 5) errors.nin = ["Invalid NIN."];
    if (!surname) errors.surname = ["Surname is required."];
    if (!otherNames) errors.otherNames = ["Other names are required."];
    if (!dateOfBirth) errors.dateOfBirth = ["Date of birth is required."];
    if (!gender) errors.gender = ["Gender is required."];
    if (!maritalStatus) errors.maritalStatus = ["Marital status is required."];
    if (!nokName) errors.nokName = ["Next of Kin name is required."];
    if (!nokPhone) errors.nokPhone = ["Next of Kin phone is required."];

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ fieldErrors: errors }, { status: 400 });
    }

    // Check Email Uniqueness (excluding current user)
    const existingEmail = await db.user.findFirst({
      where: {
        email: email,
        id: { not: authenticatedUser.id },
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        { fieldErrors: { email: ["Email already in use."] } },
        { status: 400 }
      );
    }

    // Check NIN Uniqueness (excluding current member)
    const existingNIN = await db.member.findFirst({
      where: {
        nin: nin,
        userId: { not: authenticatedUser.id },
      },
    });

    if (existingNIN) {
      return NextResponse.json(
        { fieldErrors: { nin: ["NIN already registered."] } },
        { status: 400 }
      );
    }

    // Calculate Age
    const dobDate = new Date(dateOfBirth);
    const ageDiffMs = Date.now() - dobDate.getTime();
    const ageDate = new Date(ageDiffMs); 
    const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

    // Generate member number if needed
    const currentYear = new Date().getFullYear();
    const count = await db.member.count();
    const memberNumber = `MB-${currentYear}-${(count + 1).toString().padStart(4, "0")}`;

    // Update Transaction
    const [, member] = await db.$transaction([
      db.user.update({
        where: { id: authenticatedUser.id },
        data: { 
          email: email.toLowerCase().trim(),
          name: `${surname} ${otherNames}`.trim(),
          firstName: otherNames.split(" ")[0] || otherNames,
          lastName: surname,
          dateOfBirth: dobDate,
          address: address,
          phone: phone || undefined,
        },
      }),
      db.member.upsert({
        where: { userId: authenticatedUser.id },
        update: { 
          nin: nin.toUpperCase().trim(),
          surname: surname.toUpperCase(),
          otherNames: otherNames.toUpperCase(),
          age: calculatedAge,
          gender: gender as any,
          maritalStatus: maritalStatus as any,
          occupation: occupation,
          citizenship: citizenship,
          postalAddress: address,
          nokName: nokName,
          nokRelationship: nokRelationship,
          nokPhone: nokPhone,
        },
        create: {
          userId: authenticatedUser.id,
          memberNumber: memberNumber,
          nin: nin.toUpperCase().trim(),
          surname: surname.toUpperCase(),
          otherNames: otherNames.toUpperCase(),
          age: calculatedAge,
          gender: gender as any,
          maritalStatus: maritalStatus as any,
          occupation: occupation,
          citizenship: citizenship,
          postalAddress: address,
          nokName: nokName,
          nokRelationship: nokRelationship,
          nokPhone: nokPhone,
          status: "PENDING_APPROVAL",
        },
        select: {
          isApproved: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      nextUrl: member?.isApproved ? "/dashboard" : "/pending-approval",
    });
  } catch (error) {
    console.error("Profile API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
