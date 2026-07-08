// "use server";

// import { db } from "@/prisma/db";
// import { MemberUpdateDTO } from "@/types/member";
// import { revalidatePath } from "next/cache";

// // Get Member by User ID (already created in user actions, but including here for completeness)
// export async function getMemberByUserId(userId: string) {
//   try {
//     const member = await db.member.findUnique({
//       where: { userId },
//       include: {
//         user: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             name: true,
//             email: true,
//             phone: true,
//             dateOfBirth: true,
//             nationalId: true,
//             jobTitle: true,
//             role: true,
//             isActive: true,
//             isVerified: true,
//             createdAt: true,
//             updatedAt: true,
//           },
//         },
//       },
//     });

//     if (!member) {
//       return {
//         error: "Member not found",
//         data: null,
//       };
//     }

//     return {
//       error: null,
//       data: member,
//     };
//   } catch (error) {
//     console.error("Error fetching member:", error);
//     return {
//       error: "Failed to fetch member",
//       data: null,
//     };
//   }
// }

// // Update Member by ID
// export async function updateMemberById(id: string, data: MemberUpdateDTO) {
//   try {
//     if (!id) {
//       return {
//         error: "Member ID is required",
//         data: null,
//       };
//     }

//     // Check if member exists
//     const existingMember = await db.member.findUnique({
//       where: { id },
//       include: {
//         user: true,
//       },
//     });

//     if (!existingMember) {
//       return {
//         error: "Member not found",
//         data: null,
//       };
//     }

//     // Prepare update data - only include fields that are provided
//     const updateData: any = {};

//     // Personal Information
//     if (data.surname !== undefined) updateData.surname = data.surname;
//     if (data.otherNames !== undefined) updateData.otherNames = data.otherNames;
//     if (data.age !== undefined) updateData.age = data.age;
//     if (data.gender !== undefined) updateData.gender = data.gender;
//     if (data.maritalStatus !== undefined)
//       updateData.maritalStatus = data.maritalStatus;
//     if (data.maritalOther !== undefined)
//       updateData.maritalOther = data.maritalOther;

//     // Family Information
//     if (data.nokName !== undefined) updateData.nokName = data.nokName;
//     if (data.nokRelationship !== undefined)
//       updateData.nokRelationship = data.nokRelationship;
//     if (data.nokPhone !== undefined) updateData.nokPhone = data.nokPhone;
//     if (data.numberOfChildren !== undefined)
//       updateData.numberOfChildren = data.numberOfChildren;
//     if (data.numberOfDependants !== undefined)
//       updateData.numberOfDependants = data.numberOfDependants;
//     if (data.fatherName !== undefined) updateData.fatherName = data.fatherName;
//     if (data.motherName !== undefined) updateData.motherName = data.motherName;

//     // Background Information
//     if (data.levelOfEducation !== undefined)
//       updateData.levelOfEducation = data.levelOfEducation;
//     if (data.citizenship !== undefined)
//       updateData.citizenship = data.citizenship;
//     if (data.occupation !== undefined) updateData.occupation = data.occupation;
//     if (data.otherFinancialInstitutions !== undefined)
//       updateData.otherFinancialInstitutions = data.otherFinancialInstitutions;

//     // Address Information
//     if (data.village !== undefined) updateData.village = data.village;
//     if (data.parish !== undefined) updateData.parish = data.parish;
//     if (data.subCounty !== undefined) updateData.subCounty = data.subCounty;
//     if (data.constituency !== undefined)
//       updateData.constituency = data.constituency;
//     if (data.town !== undefined) updateData.town = data.town;
//     if (data.district !== undefined) updateData.district = data.district;
//     if (data.postalAddress !== undefined)
//       updateData.postalAddress = data.postalAddress;

//     // Identity Information
//     if (data.nin !== undefined) updateData.nin = data.nin;
//     if (data.typeOfId !== undefined) updateData.typeOfId = data.typeOfId;
//     if (data.passportPhoto !== undefined)
//       updateData.passportPhoto = data.passportPhoto;
//     if (data.idCopyPath !== undefined) updateData.idCopyPath = data.idCopyPath;

//     // SACCO Specific Information
//     if (data.certifiedBy !== undefined)
//       updateData.certifiedBy = data.certifiedBy;
//     if (data.certifierAccountNo !== undefined)
//       updateData.certifierAccountNo = data.certifierAccountNo;
//     if (data.certifierPhone !== undefined)
//       updateData.certifierPhone = data.certifierPhone;
//     if (data.certificationDate !== undefined)
//       updateData.certificationDate = data.certificationDate;
//     if (data.withdrawalInstructions !== undefined)
//       updateData.withdrawalInstructions = data.withdrawalInstructions;

//     // Recommendation Information
//     if (data.applicantOccupationLC !== undefined)
//       updateData.applicantOccupationLC = data.applicantOccupationLC;
//     if (data.designationLC !== undefined)
//       updateData.designationLC = data.designationLC;
//     if (data.locationLC !== undefined) updateData.locationLC = data.locationLC;
//     if (data.otherSaccosCount !== undefined)
//       updateData.otherSaccosCount = data.otherSaccosCount;
//     if (data.financialDiscipline !== undefined)
//       updateData.financialDiscipline = data.financialDiscipline;
//     if (data.recommenderName !== undefined)
//       updateData.recommenderName = data.recommenderName;
//     if (data.recommenderTitle !== undefined)
//       updateData.recommenderTitle = data.recommenderTitle;
//     if (data.recommenderPhone !== undefined)
//       updateData.recommenderPhone = data.recommenderPhone;
//     if (data.recommendationDate !== undefined)
//       updateData.recommendationDate = data.recommendationDate;

//     // Declaration Information
//     if (data.entryFee !== undefined) updateData.entryFee = data.entryFee;
//     if (data.initialSavings !== undefined)
//       updateData.initialSavings = data.initialSavings;
//     if (data.nominee !== undefined) updateData.nominee = data.nominee;

//     // Official Use (Admin only)
//     if (data.approvalDate !== undefined)
//       updateData.approvalDate = data.approvalDate;
//     if (data.rejectionReason !== undefined)
//       updateData.rejectionReason = data.rejectionReason;
//     if (data.savingsAccountNumber !== undefined)
//       updateData.savingsAccountNumber = data.savingsAccountNumber;

//     // Update member in database
//     const updatedMember = await db.member.update({
//       where: { id },
//       data: updateData,
//       include: {
//         user: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             name: true,
//             email: true,
//             phone: true,
//             dateOfBirth: true,
//             nationalId: true,
//             jobTitle: true,
//             role: true,
//             isActive: true,
//             isVerified: true,
//             createdAt: true,
//             updatedAt: true,
//           },
//         },
//       },
//     });

//     // Revalidate related pages
//     revalidatePath("/dashboard/members");
//     revalidatePath(`/dashboard/members/${existingMember.userId}/edit`);
//     revalidatePath("/dashboard");

//     return {
//       error: null,
//       data: updatedMember,
//     };
//   } catch (error) {
//     console.error("Error updating member:", error);
//     return {
//       error: "Failed to update member. Please try again.",
//       data: null,
//     };
//   }
// }

// // Approve Member
// export async function approveMember(memberId: string) {
//   try {
//     const member = await db.member.findUnique({
//       where: { id: memberId },
//       include: { user: true },
//     });

//     if (!member) {
//       return {
//         error: "Member not found",
//         data: null,
//       };
//     }

//     const updatedMember = await db.member.update({
//       where: { id: memberId },
//       data: {
//         isApproved: true,
//         approvalDate: new Date(),
//       },
//       include: {
//         user: true,
//       },
//     });

//     // Revalidate related pages
//     revalidatePath("/dashboard/members");
//     revalidatePath(`/dashboard/members/${member.userId}/edit`);
//     revalidatePath("/dashboard");

//     return {
//       error: null,
//       data: updatedMember,
//     };
//   } catch (error) {
//     console.error("Error approving member:", error);
//     return {
//       error: "Failed to approve member",
//       data: null,
//     };
//   }
// }

// // Reject Member
// export async function rejectMember(memberId: string, reason: string) {
//   try {
//     const member = await db.member.findUnique({
//       where: { id: memberId },
//       include: { user: true },
//     });

//     if (!member) {
//       return {
//         error: "Member not found",
//         data: null,
//       };
//     }

//     const updatedMember = await db.member.update({
//       where: { id: memberId },
//       data: {
//         isApproved: false,
//         rejectionReason: reason,
//         approvalDate: new Date(), // Date of decision
//       },
//       include: {
//         user: true,
//       },
//     });

//     // Revalidate related pages
//     revalidatePath("/dashboard/members");
//     revalidatePath(`/dashboard/members/${member.userId}/edit`);
//     revalidatePath("/dashboard");

//     return {
//       error: null,
//       data: updatedMember,
//     };
//   } catch (error) {
//     console.error("Error rejecting member:", error);
//     return {
//       error: "Failed to reject member",
//       data: null,
//     };
//   }
// }

// // Get all members with pagination
// export async function getMembers(page: number = 1, limit: number = 10) {
//   try {
//     const skip = (page - 1) * limit;

//     const [members, total] = await Promise.all([
//       db.member.findMany({
//         skip,
//         take: limit,
//         include: {
//           user: {
//             select: {
//               id: true,
//               firstName: true,
//               lastName: true,
//               name: true,
//               email: true,
//               phone: true,
//               role: true,
//               isActive: true,
//               createdAt: true,
//             },
//           },
//         },
//         orderBy: {
//           createdAt: "desc",
//         },
//       }),
//       db.member.count(),
//     ]);

//     return {
//       error: null,
//       data: {
//         members,
//         pagination: {
//           page,
//           limit,
//           total,
//           pages: Math.ceil(total / limit),
//         },
//       },
//     };
//   } catch (error) {
//     console.error("Error fetching members:", error);
//     return {
//       error: "Failed to fetch members",
//       data: null,
//     };
//   }
// }

"use server";

import { db } from "@/prisma/db";
import { revalidatePath } from "next/cache";

// Define the interface directly in this file since it's not exported from types/member
interface MemberUpdateDTO {
  // Personal Information
  surname?: string;
  otherNames?: string;
  age?: number;
  gender?: string;
  maritalStatus?: string;
  maritalOther?: string;

  // Family Information
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  numberOfChildren?: number;
  numberOfDependants?: number;
  fatherName?: string;
  motherName?: string;

  // Background Information
  levelOfEducation?: string;
  citizenship?: string;
  occupation?: string;
  otherFinancialInstitutions?: string;

  // Address Information
  village?: string;
  parish?: string;
  subCounty?: string;
  constituency?: string;
  town?: string;
  district?: string;
  postalAddress?: string;

  // Identity Information
  nin?: string;
  typeOfId?: string;
  passportPhoto?: string;
  idCopyPath?: string;

  // SACCO Specific Information
  certifiedBy?: string;
  certifierAccountNo?: string;
  certifierPhone?: string;
  certificationDate?: Date | string;
  withdrawalInstructions?: string;

  // Recommendation Information
  applicantOccupationLC?: string;
  designationLC?: string;
  locationLC?: string;
  otherSaccosCount?: number;
  financialDiscipline?: string;
  recommenderName?: string;
  recommenderTitle?: string;
  recommenderPhone?: string;
  recommendationDate?: Date | string;

  // Declaration Information
  entryFee?: number;
  initialSavings?: number;
  nominee?: string;

  // Official Use (Admin only)
  approvalDate?: Date | string;
  rejectionReason?: string;
  savingsAccountNumber?: string;
}

// Get Member by User ID (already created in user actions, but including here for completeness)
// export async function getMemberByUserId(userId: string) {
//   try {
//     console.log("getMemberByUserId - Input userId:", userId); // Debug log

//     // First check if user exists
//     const user = await db.user.findUnique({
//       where: { id: userId },
//       select: {
//         id: true,
//         firstName: true,
//         lastName: true,
//         name: true,
//         email: true,
//         phone: true,
//         role: true,
//         nationalId: true,
//         jobTitle: true,
//         areaOfOperation: true,
//         dateOfBirth: true,
//         isActive: true,
//         isVerified: true,
//         createdAt: true,
//         updatedAt: true,
//         branch: {
//           select: {
//             id: true,
//             name: true,
//           },
//         },
//       },
//     });

//     console.log("getMemberByUserId - User found:", !!user); // Debug log

//     if (!user) {
//       console.log("getMemberByUserId - No user found with ID:", userId);
//       return {
//         error: "User not found",
//         data: null,
//       };
//     }

//     // Try to find member record
//     let member = null;

//     try {
//       member = await db.member.findFirst({
//         where: { userId: userId },
//         include: {
//           accounts: {
//             select: {
//               id: true,
//               accountNumber: true,
//               accountType: true,
//               balance: true,
//               status: true,
//             },
//           },
//           loans: {
//             select: {
//               id: true,
//               status: true,
//             },
//           },
//         },
//       });

//       console.log("getMemberByUserId - Member found:", !!member); // Debug log
//     } catch (memberError) {
//       console.error("getMemberByUserId - Error finding member:", memberError);
//       // Continue even if member not found - user might not be a member yet
//     }

//     // If user exists but no member record, create a basic response
//     if (!member) {
//       console.log("getMemberByUserId - Creating member-like response for user");
//       return {
//         error: null,
//         data: {
//           id: null, // No member ID since no member record exists
//           userId: user.id,
//           memberNumber: null,
//           isApproved: false,
//           registrationDate: null,
//           // Include all other member fields as null/undefined
//           surname: user.firstName,
//           otherNames: user.lastName,
//           nin: user.nationalId,
//           occupation: user.jobTitle,
//           user: user,
//           accounts: [],
//           loans: [],
//           // Add all other member fields as null
//           age: null,
//           gender: null,
//           maritalStatus: null,
//           maritalOther: null,
//           village: null,
//           parish: null,
//           subCounty: null,
//           constituency: null,
//           town: null,
//           district: null,
//           postalAddress: null,
//           levelOfEducation: null,
//           citizenship: null,
//           otherFinancialInstitutions: null,
//           nokName: null,
//           nokRelationship: null,
//           nokPhone: null,
//           numberOfChildren: null,
//           numberOfDependants: null,
//           fatherName: null,
//           motherName: null,
//           typeOfId: null,
//           passportPhoto: null,
//           idCopyPath: null,
//           certifiedBy: null,
//           certifierAccountNo: null,
//           certifierPhone: null,
//           certificationDate: null,
//           withdrawalInstructions: null,
//           createdAt: user.createdAt,
//           updatedAt: user.updatedAt,
//         },
//       };
//     }

//     // Return member with user data
//     const result = {
//       error: null,
//       data: {
//         ...member,
//         user: user,
//       },
//     };

//     console.log("getMemberByUserId - Success, returning data"); // Debug log
//     return result;
//   } catch (error) {
//     console.error("getMemberByUserId - Database error:", error);
//     return {
//       error: "Failed to fetch member data",
//       data: null,
//     };
//   }
// }
export async function getMemberByUserId(userId: string) {
  try {
    console.log("getMemberByUserId called with userId:", userId);

    const member = await db.member.findFirst({
      where: {
        userId: userId,
      },
      include: {
        user: true,
      },
    });

    console.log("Found member:", {
      id: member?.id,
      userId: member?.userId,
      memberNumber: member?.memberNumber,
    });

    if (!member) {
      return { data: null, error: "Member not found" };
    }

    // Ensure the member has an ID
    if (!member.id) {
      console.error("Member found but ID is missing:", member);
      return { data: null, error: "Member data is invalid" };
    }

    return { data: member, error: null };
  } catch (error) {
    console.error("Error in getMemberByUserId:", error);
    return { data: null, error: "Failed to fetch member" };
  }
}
// Update Member by ID
export async function updateMemberById(id: string, data: MemberUpdateDTO) {
  try {
    if (!id) {
      return {
        error: "Member ID is required",
        data: null,
      };
    }

    // Check if member exists
    const existingMember = await db.member.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existingMember) {
      return {
        error: "Member not found",
        data: null,
      };
    }

    // Prepare update data - only include fields that are provided
    const updateData: any = {};

    // Personal Information
    if (data.surname !== undefined) updateData.surname = data.surname;
    if (data.otherNames !== undefined) updateData.otherNames = data.otherNames;
    if (data.age !== undefined) updateData.age = data.age;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.maritalStatus !== undefined)
      updateData.maritalStatus = data.maritalStatus;
    if (data.maritalOther !== undefined)
      updateData.maritalOther = data.maritalOther;

    // Family Information
    if (data.nokName !== undefined) updateData.nokName = data.nokName;
    if (data.nokRelationship !== undefined)
      updateData.nokRelationship = data.nokRelationship;
    if (data.nokPhone !== undefined) updateData.nokPhone = data.nokPhone;
    if (data.numberOfChildren !== undefined)
      updateData.numberOfChildren = data.numberOfChildren;
    if (data.numberOfDependants !== undefined)
      updateData.numberOfDependants = data.numberOfDependants;
    if (data.fatherName !== undefined) updateData.fatherName = data.fatherName;
    if (data.motherName !== undefined) updateData.motherName = data.motherName;

    // Background Information
    if (data.levelOfEducation !== undefined)
      updateData.levelOfEducation = data.levelOfEducation;
    if (data.citizenship !== undefined)
      updateData.citizenship = data.citizenship;
    if (data.occupation !== undefined) updateData.occupation = data.occupation;
    if (data.otherFinancialInstitutions !== undefined)
      updateData.otherFinancialInstitutions = data.otherFinancialInstitutions;

    // Address Information
    if (data.village !== undefined) updateData.village = data.village;
    if (data.parish !== undefined) updateData.parish = data.parish;
    if (data.subCounty !== undefined) updateData.subCounty = data.subCounty;
    if (data.constituency !== undefined)
      updateData.constituency = data.constituency;
    if (data.town !== undefined) updateData.town = data.town;
    if (data.district !== undefined) updateData.district = data.district;
    if (data.postalAddress !== undefined)
      updateData.postalAddress = data.postalAddress;

    // Identity Information
    if (data.nin !== undefined) updateData.nin = data.nin;
    if (data.typeOfId !== undefined) updateData.typeOfId = data.typeOfId;
    if (data.passportPhoto !== undefined)
      updateData.passportPhoto = data.passportPhoto;
    if (data.idCopyPath !== undefined) updateData.idCopyPath = data.idCopyPath;

    // SACCO Specific Information
    if (data.certifiedBy !== undefined)
      updateData.certifiedBy = data.certifiedBy;
    if (data.certifierAccountNo !== undefined)
      updateData.certifierAccountNo = data.certifierAccountNo;
    if (data.certifierPhone !== undefined)
      updateData.certifierPhone = data.certifierPhone;
    if (data.certificationDate !== undefined)
      updateData.certificationDate = data.certificationDate;
    if (data.withdrawalInstructions !== undefined)
      updateData.withdrawalInstructions = data.withdrawalInstructions;

    // Recommendation Information
    if (data.applicantOccupationLC !== undefined)
      updateData.applicantOccupationLC = data.applicantOccupationLC;
    if (data.designationLC !== undefined)
      updateData.designationLC = data.designationLC;
    if (data.locationLC !== undefined) updateData.locationLC = data.locationLC;
    if (data.otherSaccosCount !== undefined)
      updateData.otherSaccosCount = data.otherSaccosCount;
    if (data.financialDiscipline !== undefined)
      updateData.financialDiscipline = data.financialDiscipline;
    if (data.recommenderName !== undefined)
      updateData.recommenderName = data.recommenderName;
    if (data.recommenderTitle !== undefined)
      updateData.recommenderTitle = data.recommenderTitle;
    if (data.recommenderPhone !== undefined)
      updateData.recommenderPhone = data.recommenderPhone;
    if (data.recommendationDate !== undefined)
      updateData.recommendationDate = data.recommendationDate;

    // Declaration Information
    if (data.entryFee !== undefined) updateData.entryFee = data.entryFee;
    if (data.initialSavings !== undefined)
      updateData.initialSavings = data.initialSavings;
    if (data.nominee !== undefined) updateData.nominee = data.nominee;

    // Official Use (Admin only)
    if (data.approvalDate !== undefined)
      updateData.approvalDate = data.approvalDate;
    if (data.rejectionReason !== undefined)
      updateData.rejectionReason = data.rejectionReason;
    if (data.savingsAccountNumber !== undefined)
      updateData.savingsAccountNumber = data.savingsAccountNumber;

    // Update member in database
    const updatedMember = await db.member.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            phone: true,
            dateOfBirth: true,
            nationalId: true,
            jobTitle: true,
            role: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    // Revalidate related pages
    revalidatePath("/dashboard/members");
    revalidatePath(`/dashboard/members/${existingMember.userId}/edit`);
    revalidatePath("/dashboard");

    return {
      error: null,
      data: updatedMember,
    };
  } catch (error) {
    console.error("Error updating member:", error);
    return {
      error: "Failed to update member. Please try again.",
      data: null,
    };
  }
}

// Approve Member
export async function approveMember(memberId: string) {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      return {
        error: "Member not found",
        data: null,
      };
    }

    if (!member.fingerprintTemplate) {
      return {
        error: "Member must enroll a fingerprint before approval.",
        data: null,
      };
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: {
        isApproved: true,
        approvalDate: new Date(),
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
      },
      include: {
        user: true,
      },
    });

    // Revalidate related pages
    revalidatePath("/dashboard/members");
    revalidatePath(`/dashboard/members/${member.userId}/edit`);
    revalidatePath("/dashboard");

    return {
      error: null,
      data: updatedMember,
    };
  } catch (error) {
    console.error("Error approving member:", error);
    return {
      error: "Failed to approve member",
      data: null,
    };
  }
}

// Reject Member
export async function rejectMember(memberId: string, reason: string) {
  try {
    const member = await db.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });

    if (!member) {
      return {
        error: "Member not found",
        data: null,
      };
    }

    const updatedMember = await db.member.update({
      where: { id: memberId },
      data: {
        isApproved: false,
        rejectionReason: reason,
        approvalDate: new Date(), // Date of decision
      },
      include: {
        user: true,
      },
    });

    // Revalidate related pages
    revalidatePath("/dashboard/members");
    revalidatePath(`/dashboard/members/${member.userId}/edit`);
    revalidatePath("/dashboard");

    return {
      error: null,
      data: updatedMember,
    };
  } catch (error) {
    console.error("Error rejecting member:", error);
    return {
      error: "Failed to reject member",
      data: null,
    };
  }
}

// Get all members with pagination
export async function getMembers(page: number = 1, limit: number = 10) {
  try {
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      db.member.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.member.count(),
    ]);

    return {
      error: null,
      data: {
        members,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching members:", error);
    return {
      error: "Failed to fetch members",
      data: null,
    };
  }
}
