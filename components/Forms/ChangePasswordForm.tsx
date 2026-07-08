"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { User as PrismaUser } from "@prisma/client";

import PasswordInput from "../FormInputs/PasswordInput";
import SubmitButton from "../FormInputs/SubmitButton";
import { Lock, LockOpen, AlertTriangle } from "lucide-react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";

export type PasswordProps = {
  oldPassword: string;
  newPassword: string;
};
export type SelectOptionProps = {
  label: string;
  value: string;
};
type ClientFormProps = {
  editingId?: string | undefined;
  initialData?: PrismaUser | undefined | null;
};
export default function ChangePasswordForm({
  editingId,
  initialData,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordProps>({
    defaultValues: {
      oldPassword: "",
      newPassword: "",
    },
  });
  const router = useRouter();
  const [passErr, setPassErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(data: PasswordProps) {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/users/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.status === 403) {
        setPassErr(result.error || "Old password is incorrect");
        setLoading(false);
        return;
      }
      if (res.ok) {
        setLoading(false);
        toast.success("Password Updated Successfully!");
        reset();
        await signOut();
        router.push("/login");
      }
    } catch (error) {
      setLoading(false);
      console.error("Network Error:", error);
      toast.error("Its seems something is wrong, try again");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
           <p className="text-sm text-slate-600 flex gap-2 items-start">
            <LockOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <span>You must update your password to continue using the system.</span>
           </p>
        </div>

        <PasswordInput
          register={register}
          errors={errors}
          label="Current Password"
          name="oldPassword"
          icon={LockOpen}
          placeholder="Enter your current password"
        />
        
        <PasswordInput
          register={register}
          errors={errors}
          label="New Password"
          name="newPassword"
          icon={Lock}
          placeholder="Enter a new strong password"
        />
        
        {passErr && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2 border border-red-100">
             <AlertTriangle className="w-4 h-4" />
             {passErr}
          </div>
        )}
      </div>

      <div className="pt-2">
        <SubmitButton
          title={loading ? "Updating Password..." : "Update Password"}
          loading={loading}
          className="w-full"
        />
        
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full mt-3 text-sm text-slate-500 hover:text-slate-800 transition-colors py-2"
        >
          Cancel and Log Out
        </button>
      </div>
    </form>
  );
}
