"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, FileText } from "lucide-react";

// Import the form content component (without Dialog wrapper)
import MemberLoanApplicationFormContent from "./LoanApplicationCreateForm";
// Import the institution form component
import InstitutionLoanApplicationForm from "./InstitutionLoanApplicationForm";

interface LoanApplicationCreateFormWithTabsProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  loanProducts: any[]; // Keep this if used by MemberLoanApplicationFormContent
}

export default function LoanApplicationCreateFormWithTabs({
  isOpen,
  onClose,
  currentUserId,
  loanProducts,
}: LoanApplicationCreateFormWithTabsProps) {
  const [activeTab, setActiveTab] = useState("member");

  const handleClose = () => {
    setActiveTab("member");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Loan Application
          </DialogTitle>
          <DialogDescription>
            Create loan application for individual members or
            institutions/organizations
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="member" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Member Application
            </TabsTrigger>
            <TabsTrigger
              value="institution"
              className="flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              Institution Application
            </TabsTrigger>
          </TabsList>

          <TabsContent value="member" className="mt-0">
            {activeTab === "member" && (
              <MemberLoanApplicationFormContent
                currentUserId={currentUserId}
                onSuccess={handleClose}
              />
            )}
          </TabsContent>

          <TabsContent value="institution" className="mt-0">
            {activeTab === "institution" && (
              <InstitutionLoanApplicationForm
                isOpen={false}
                onClose={handleClose}
                currentUserId={currentUserId}
                isEmbedded={true}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
