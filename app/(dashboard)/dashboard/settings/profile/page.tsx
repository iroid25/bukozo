"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UserProfilePage from "./components/ProfileClient";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    const currentUser = session?.user as any;
    if (!currentUser?.id) return;

    fetch(`/api/v1/users/${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) {
          setError(json.error || "Unable to load profile information.");
        } else {
          const userData = json.data;
          setUser({
            ...userData,
            dateOfBirth: userData.dateOfBirth ? new Date(userData.dateOfBirth).toISOString() : null,
            createdAt: new Date(userData.createdAt).toISOString(),
            lastLogin: userData.lastLogin ? new Date(userData.lastLogin).toISOString() : null,
            updatedAt: userData.updatedAt ? new Date(userData.updatedAt).toISOString() : null,
            branch: userData.branch
              ? { ...userData.branch, createdAt: new Date(userData.branch.createdAt).toISOString(), updatedAt: new Date(userData.branch.updatedAt).toISOString() }
              : null,
            member: userData.member ? { id: userData.member.id, memberNumber: userData.member.memberNumber } : null,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load profile information.");
        setLoading(false);
      });
  }, [session, status, router]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Profile</h1>
          <p className="text-slate-600">{error}</p>
          <a href="/dashboard" className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return <UserProfilePage user={user} />;
}
