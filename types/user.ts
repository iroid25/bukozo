import { Gender, UserRole } from "@prisma/client";

// types/user.ts
export interface User {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email: string | null;
  dateOfBirth?: Date;
  address?: string;
  nationalId?: string;
  lastLogin?: Date;
  isActive: boolean;
  emailVerified?: Date;
  image?: string;
  jobTitle?: string;
  role: UserRole;
  password?: string;
  areaOfOperation?: string;
  branchId?: string;
  isVerified: boolean;
  token?: string;
  createdAt: Date;
  updatedAt: Date;
}

// export enum UserRole {
//   ADMIN = "ADMIN",
//   MANAGER = "MANAGER",
//   TELLER = "TELLER",
//   AGENT = "AGENT",
//   MEMBER = "MEMBER",
// }

// Update DTO - make all fields optional except id
export type UserUpdateDTO = Partial<Omit<UserCreateDTO, "password">> & {
  id: string;
  password: string; // Password is optional for updates
};
// import { UserRole } from "@prisma/client";

export interface UserCreateDTO {
  // Basic user info
  firstName: string;
  lastName: string;
  name?: string;
  email: string | null;
  phone?: string | null;
  password: string;

  // Optional details
  dateOfBirth?: string | Date | null;
  registrationDate?: string | Date | null;
  gender?: Gender | string | null;
  nationalId?: string | null;
  idCard?: string | null;
  jobTitle?: string | null;
  areaOfOperation?: string | null;
  address?: string | null;
  district?: string | null;
  village?: string | null;
  parish?: string | null;
  subCounty?: string | null;
  constituency?: string | null;
  postalAddress?: string | null;
  nokName?: string | null;
  nokRelationship?: string | null;
  nokPhone?: string | null;
  image?: string | null;
  fingerprintTemplate?: string | null;
  fingerprintQuality?: number | null;

  // Role & Branch
  role?: UserRole; // Defaults to MEMBER
  branchId?: string | null;

  // Institution-specific fields (only relevant if role = INSTITUTION)
  institutionName?: string | null;
  institutionPhone?: string | null;
  institutionEmail?: string | null;
  primaryContactPerson?: string | null;
  primaryContactPhone?: string | null;
}
