import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/prisma/db";
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text", placeholder: "Email or Phone" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("🔐 Authorization attempt for:", credentials?.identifier || (credentials as any)?.email);

          const loginIdentifier = credentials?.identifier || (credentials as any)?.email;
          const normalizedIdentifier = typeof loginIdentifier === "string"
            ? loginIdentifier.trim()
            : "";

          if (!normalizedIdentifier || !credentials?.password) {
            console.warn("⚠️ Missing credentials");
            throw new Error("No Inputs Found");
          }

          const normalizedEmail = normalizedIdentifier.toLowerCase();
          const normalizedPhone = normalizedIdentifier.replace(/\s+/g, "");
          
          const existingUser = await db.user.findFirst({
            where: {
              OR: [
                { email: { equals: normalizedEmail, mode: "insensitive" } },
                { phone: normalizedPhone }
              ]
            },
            include: {
              branch: true,
            },
          });

          if (!existingUser) {
            console.warn(`❌ No user found with identifier: ${normalizedIdentifier}`);
            throw new Error("No user found");
          }

          let passwordMatch: boolean = false;
          if (existingUser && existingUser.password) {
            passwordMatch = await compare(
              credentials.password,
              existingUser.password
            );
          }

          if (!existingUser.isVerified) {
            console.warn(`⚠️ User not verified: ${normalizedIdentifier}`);
            throw new Error("User Not Verified");
          }

          if (!passwordMatch) {
            console.warn(`❌ Password incorrect for: ${normalizedIdentifier}`);
            throw new Error("Password Incorrect");
          }

          console.log(`✅ Authorization successful for: ${normalizedIdentifier} (${existingUser.role})`);

          // Calculate Password Expiration
          let isExpired = false;
          const expiryDays = existingUser.passwordExpiryDays || 90;
          const lastChanged = existingUser.passwordLastChanged || existingUser.createdAt;
          
          if (lastChanged) {
            const timeDiff = Date.now() - new Date(lastChanged).getTime();
            const daysDiff = timeDiff / (1000 * 3600 * 24);
            if (daysDiff >= expiryDays) {
              isExpired = true;
            }
          }

          return {
            id: existingUser.id,
            name: existingUser.name,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            phone: existingUser.phone,
            image: existingUser.image,
            email: existingUser.email || "", // Handle optional email
            role: existingUser.role,
            branchId: existingUser.branchId,
            branchName: existingUser.branch?.name || "",
            branchLocation: existingUser.branch?.location || "",
            requiresPasswordChange: existingUser.requiresPasswordChange || isExpired,
          };
        } catch (error: any) {
          console.error("🔥 Authorization Error:", error.message || error);
          throw new Error(error.message || "Something went wrong");
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // For initial sign in
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.phone = user.phone;
        token.role = user.role;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
        token.branchLocation = user.branchLocation;
        token.requiresPasswordChange = user.requiresPasswordChange;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.phone = token.phone;
        session.user.role = token.role;

        session.user.branchId = token.branchId;
        session.user.branchName = token.branchName;
        session.user.branchLocation = token.branchLocation;
        session.user.requiresPasswordChange = token.requiresPasswordChange;
      }
      return session;
    },
  },
};
