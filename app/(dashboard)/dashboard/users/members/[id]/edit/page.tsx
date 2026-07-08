"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MemberUpdateClient from "./MemberUpdateClient";

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Get user (which includes member relation)
      const [userRes, branchesRes] = await Promise.all([
        fetch(`/api/v1/users/${id}`),
        fetch("/api/v1/branches"),
      ]);
      const userJson = await userRes.json();
      const branchesJson = await branchesRes.json();

      const userData = userJson.data;
      if (!userData?.member?.id) {
        router.push("/dashboard/users/members");
        return;
      }

      // Get full member data
      const memberRes = await fetch(`/api/v1/members/${userData.member.id}`);
      const memberJson = await memberRes.json();

      setMember(memberJson.data ? { ...memberJson.data, user: userData } : null);
      setBranches(branchesJson.data || []);
      setLoading(false);
    }
    load();
  }, [id, router]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;
  if (!member) return null;

  return (
    <MemberUpdateClient
      member={member as any}
      branches={branches}
      hasFingerprint={Boolean(member.fingerprintTemplate)}
    />
  );
}
