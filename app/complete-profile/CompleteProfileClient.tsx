"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ProfileForm from "./ProfileForm";

type InitialData = {
  surname?: string;
  otherNames?: string;
  email?: string;
  nin?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  occupation?: string;
  citizenship?: string;
  address?: string;
  phone?: string;
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
};

export default function CompleteProfileClient() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    const loadProfileStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/profile/status", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load profile");
        }

        if (result.nextUrl && result.nextUrl !== "/complete-profile") {
          router.replace(result.nextUrl);
          return;
        }

        if (!cancelled) {
          setInitialData(result.initialData || {});
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfileStatus();

    return () => {
      cancelled = true;
    };
  }, [router, status]);

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          <p className="text-sm text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Unable to load profile</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return <ProfileForm initialData={initialData || {}} />;
}
