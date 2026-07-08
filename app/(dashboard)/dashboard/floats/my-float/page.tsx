// @ts-nocheck
import { Suspense } from "react";
import MyFloatPageClient from "./MyFloatPageClient";

export default function MyFloatPage() {
  return (
    <div className="flex h-full  w-[78vw] overflow-hidden justify-end flex-2 flex-col gap-4 rounded-xl p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <MyFloatPageClient />
      </Suspense>
    </div>
  );
}
