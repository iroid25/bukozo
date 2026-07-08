"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AccountantEditClient from "./AccountantEditClient";

export default function EditAccountantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [userResp, branchesResp] = await Promise.all([
        axios.get(`/api/v1/users/${id}`),
        axios.get("/api/v1/lookups/branches")
      ]);

      if (userResp.data.success && branchesResp.data.success) {
        setUser(userResp.data.data);
        setBranches(branchesResp.data.data);
      } else {
        throw new Error("Failed to fetch data");
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="p-4 rounded-full bg-red-50 text-red-500">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 leading-tight">Fetch failed</h2>
          <p className="text-neutral-500 mt-2 max-w-sm mx-auto">{error || "User not found"}</p>
        </div>
        <Button 
          onClick={() => router.push("/dashboard/users/accountants")}
          className="bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl px-8"
        >
          Back to Listing
        </Button>
      </div>
    );
  }

  return (
    <AccountantEditClient user={user} branches={branches} />
  );
}
