# Phone-Based Login System - Implementation Guide

## Overview

Members in the Bukonzo SACCO system log in using their **phone numbers** instead of email addresses. After first login, they are required to update their profile information (including adding an email) before they can access the system.

## Authentication Flow

### 1. Member Login Process

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Member enters PHONE NUMBER + PASSWORD                    │
│    Example: +256777309854 / Member@2026                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. System validates credentials                              │
│    - Find user by phone number                               │
│    - Verify password                                         │
│    - Check if user.requiresPasswordChange === true           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3a. First Login (requiresPasswordChange = true)             │
│     → Redirect to Profile Update Page                        │
│                                                              │
│ 3b. Subsequent Logins (requiresPasswordChange = false)      │
│     → Redirect to Member Dashboard                           │
└─────────────────────────────────────────────────────────────┘
```

### 2. First-Time Profile Update

After initial login, members must:

1. ✅ Add email address (optional but recommended)
2. ✅ Update password (required)
3. ✅ Verify personal information (name, address)
4. ✅ Review account details
5. ✅ Accept terms and conditions

Only after completing this can they proceed to the dashboard.

## Database Schema Requirements

Your User model should support phone-based authentication:

```prisma
model User {
  id                      String    @id @default(cuid())
  firstName               String
  lastName                String
  name                    String
  email                   String?   @unique  // Optional - can be null
  phone                   String    @unique  // Required - primary login
  password                String
  role                    Role      @default(MEMBER)
  isActive                Boolean   @default(true)
  isVerified              Boolean   @default(false)
  requiresPasswordChange  Boolean   @default(true)
  address                 String?
  nationalId              String?
  dateOfBirth             DateTime?
  branchId                String?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
}
```

**Key Points:**
- `email` is **nullable** and **unique**
- `phone` is **required** and **unique**
- `requiresPasswordChange` defaults to `true` for new members
- `isVerified` is `false` until profile is updated

## Implementation

### 1. Login API Endpoint

```typescript
// app/api/auth/login/route.ts
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt"; // or your auth method

export async function POST(req: Request) {
  const { phoneOrEmail, password } = await req.json();

  // Find user by phone or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: phoneOrEmail },
        { email: phoneOrEmail },
      ],
      role: "MEMBER",
      isActive: true,
    },
    include: {
      member: true,
    },
  });

  if (!user) {
    return Response.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return Response.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  // Check if profile update required
  const requiresProfileUpdate = user.requiresPasswordChange || !user.email;

  // Generate session/token
  const token = await signJWT({ userId: user.id, role: user.role });

  return Response.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      requiresProfileUpdate,
    },
    redirectTo: requiresProfileUpdate 
      ? "/member/profile/update" 
      : "/member/dashboard",
  });
}
```

### 2. Login Form Component

```typescript
// components/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneOrEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store token
      localStorage.setItem("token", data.token);

      // Redirect based on profile status
      router.push(data.redirectTo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="phoneOrEmail" className="block text-sm font-medium">
          Phone Number or Email
        </label>
        <input
          id="phoneOrEmail"
          type="text"
          placeholder="+256700000000 or email@example.com"
          value={phoneOrEmail}
          onChange={(e) => setPhoneOrEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Use your phone number to login
        </p>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          required
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
```

### 3. Profile Update Page (First Login)

```typescript
// app/member/profile/update/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfileUpdatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: "",
    address: "",
    acceptTerms: false,
  });

  useEffect(() => {
    // Load current user data
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    setUser(data.user);
    setFormData((prev) => ({
      ...prev,
      address: data.user.address || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    if (!formData.acceptTerms) {
      alert("Please accept the terms and conditions");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/member/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email || null,
          password: formData.newPassword,
          address: formData.address,
        }),
      });

      if (!res.ok) {
        throw new Error("Update failed");
      }

      // Redirect to dashboard
      router.push("/member/dashboard");
    } catch (error) {
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 mb-6">
        <h2 className="text-lg font-semibold text-yellow-800">
          Welcome to Bukonzo SACCO!
        </h2>
        <p className="mt-2 text-sm text-yellow-700">
          Please update your profile to continue. This is required for first-time login.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Information */}
        <div className="rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold mb-4">Current Information</h3>
          <div className="space-y-2 text-sm">
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Phone:</strong> {user.phone}</p>
            <p><strong>Member Number:</strong> {user.member?.memberNumber}</p>
          </div>
        </div>

        {/* Email (Optional) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email Address (Optional but recommended)
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            placeholder="your.email@example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            Add your email to receive statements and notifications
          </p>
        </div>

        {/* New Password (Required) */}
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium">
            New Password <span className="text-red-500">*</span>
          </label>
          <input
            id="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-gray-500">
            Must be at least 8 characters
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            required
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium">
            Physical Address
          </label>
          <textarea
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            rows={3}
            placeholder="Your physical address"
          />
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-start">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={formData.acceptTerms}
            onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-gray-300"
            required
          />
          <label htmlFor="acceptTerms" className="ml-2 text-sm">
            I accept the{" "}
            <a href="/terms" className="text-blue-600 hover:underline">
              Terms and Conditions
            </a>{" "}
            and{" "}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
            <span className="text-red-500">*</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Updating..." : "Complete Profile & Continue"}
        </button>
      </form>
    </div>
  );
}
```

### 4. Profile Update API

```typescript
// app/api/member/profile/update/route.ts
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth"; // Your auth helper

export async function PUT(req: Request) {
  const currentUser = await getCurrentUser(req);
  
  if (!currentUser || currentUser.role !== "MEMBER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, password, address } = await req.json();

  try {
    // Hash new password if provided
    const hashedPassword = password 
      ? await bcrypt.hash(password, 10) 
      : undefined;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        email: email || null,
        password: hashedPassword,
        address: address || null,
        requiresPasswordChange: false, // Profile is now complete
        isVerified: true, // Mark as verified after profile update
        updatedAt: new Date(),
      },
    });

    return Response.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    // Handle duplicate email error
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return Response.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    return Response.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
```

### 5. Route Protection Middleware

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/jwt";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const payload = await verifyJWT(token);
    
    // Check if user needs to update profile
    if (
      payload.requiresProfileUpdate &&
      !request.nextUrl.pathname.startsWith("/member/profile/update")
    ) {
      return NextResponse.redirect(
        new URL("/member/profile/update", request.url)
      );
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/member/:path*", "/dashboard/:path*"],
};
```

## Member Experience Flow

### First Login
```
1. Member receives SMS: "Welcome to Bukonzo SACCO! Login: +256777309854, Password: Member@2026"

2. Member visits login page → Enters phone + password

3. System detects first login → Redirects to profile update page

4. Member sees welcome message and current info (name, phone, member number)

5. Member fills out:
   ✓ Email address (optional)
   ✓ New password (required)
   ✓ Confirm address
   ✓ Accept terms

6. Member submits → System updates profile

7. Member is redirected to dashboard with full access
```

### Subsequent Logins
```
1. Member enters phone/email + password

2. System validates credentials

3. Member is directly redirected to dashboard
```

## SMS Notification Template

After seeding, send SMS to all members:

```
Welcome to Bukonzo SACCO Online Banking!

Login Details:
Phone: [MEMBER_PHONE]
Password: Member@2026

Visit: https://sacco.bukonzo.ug

You will be asked to update your password and add email on first login.

For help, call: +256700111222
```

## Security Considerations

### 1. Password Requirements
```typescript
// Enforce strong passwords on profile update
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional for rural users
};
```

### 2. Phone Number Verification
Consider implementing SMS OTP for:
- Profile updates
- Large withdrawals
- Password resets

### 3. Email Verification
If member adds email:
```typescript
// Send verification email
await sendEmailVerification(user.email);

// Mark as unverified until confirmed
await prisma.user.update({
  where: { id: user.id },
  data: { emailVerified: false },
});
```

### 4. Rate Limiting
Protect login endpoint:
```typescript
// Rate limit: 5 attempts per 15 minutes per phone number
const rateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body.phoneOrEmail,
});
```

## Testing Checklist

- [ ] Member can login with phone number
- [ ] Member can login with email (after adding it)
- [ ] First login redirects to profile update
- [ ] Profile update validates all fields
- [ ] Password change works correctly
- [ ] Email uniqueness is enforced
- [ ] Terms acceptance is required
- [ ] Subsequent logins skip profile update
- [ ] Member dashboard shows correct data
- [ ] Account balances are displayed
- [ ] Loan information is visible

## Troubleshooting

### "Phone number not found"
- Verify phone is in +256 format
- Check that member was seeded successfully
- Ensure phone is unique in database

### "Email already in use"
- Another member has this email
- Provide clear error message
- Allow member to choose different email

### Profile update loop
- Check `requiresPasswordChange` flag
- Ensure it's set to `false` after update
- Verify redirect logic in middleware

---

**Ready to implement?** Start with the login form and profile update page. Test with sample phone numbers from the seed data!
