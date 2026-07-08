import RoleBasedWrapper from "@/components/RoleBasedWrapper";
import React, { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleBasedWrapper
      allowedRoles={["ADMIN", "TELLER", "BRANCHMANAGER", "DATA_ENTRANT"]}
    >
      {children}
    </RoleBasedWrapper>
  );
}
