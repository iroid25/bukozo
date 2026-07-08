"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import ChangePasswordClient from "../../change-password/components/ChangePasswordClient";

export default function ChangePasswordSettingsPage() {
  const { data: session } = useSession();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = session?.user as any;
    if (currentUser?.id) {
      fetch(`/api/v1/users/${currentUser.id}`)
        .then((r) => r.json())
        .then((json) => {
          setUser(json.data || null);
          setLoading(false);
        });
    }
  }, [session]);

  if (loading || !user) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-8">
      <ChangePasswordClient user={{ id: user.id, name: user.name, email: user.email }} />
    </div>
  );
}
