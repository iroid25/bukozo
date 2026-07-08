import ResetPasswordForm from "@/components/Forms/ResetPasswordForm";
import React, { Suspense } from "react";

export default async function page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0A0C10]"><div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
