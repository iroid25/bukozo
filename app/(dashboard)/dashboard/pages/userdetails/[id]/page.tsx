import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/config/useAuth";
import { Suspense } from "react";
import UserDetailClient from "../UseDetail";
import { serverFetch } from "@/lib/server-fetch";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

function UserDetailLoading(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="animate-pulse">
        <div className="mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-6">
            <div className="h-32 w-32 bg-gray-200 rounded-full"></div>
            <div className="flex-1 space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  const res = await serverFetch(`/api/v1/users/${id}`);
  if (!res.ok) return { title: "User Details" };
  const { data: user } = await res.json();
  const name = user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim();
  return {
    title: name ? `${name} - User Details` : "User Details",
    description: user ? `Profile page for ${name} (${user.role})` : "User profile page",
  };
}

async function UserDetailContent({ userId }: { userId: string }) {
  const currentUser = await getAuthUser();
  if (!currentUser) redirect("/login");

  const res = await serverFetch(`/api/v1/users/${userId}/profile`);

  if (!res.ok) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600 mb-6">The requested user could not be found in the system.</p>
          <a href="/dashboard/users" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Users
          </a>
        </div>
      </div>
    );
  }

  const json = await res.json();
  const { user, recentActivity } = json.data;

  const serializedActivity = recentActivity.map((a: any) => ({
    ...a,
    timestamp: typeof a.timestamp === "string" ? a.timestamp : new Date(a.timestamp).toISOString(),
  }));

  return (
    <UserDetailClient
      user={user}
      currentUser={{
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role as any,
        image: currentUser.image,
      }}
      recentActivity={serializedActivity}
      floatTransactions={user.floatTransactions || []}
    />
  );
}

export default async function UserDetailPage(props: PageProps) {
  const params = await props.params;
  return (
    <Suspense fallback={<UserDetailLoading />}>
      <UserDetailContent userId={params.id} />
    </Suspense>
  );
}
