// @ts-nocheck
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PersonalInfoTab } from "./tabs/personal-info-tab";
import { FamilyInfoTab } from "./tabs/family-info-tab";
import { BackgroundInfoTab } from "./tabs/background-info-tab";
import { AddressInfoTab } from "./tabs/address-info-tab";
import { IdentityInfoTab } from "./tabs/identity-info-tab";
import { SaccoInfoTab } from "./tabs/sacco-info-tab";
import { RecommendationTab } from "./tabs/recommendation-tab";
import { DeclarationTab } from "./tabs/declaration-tab";

import { cn } from "@/lib/utils";
import type { Member } from "@/types/member";

export interface Option {
  label: string;
  value: string;
}

export function MemberUpdateForm({
  member,
}: {
  member: Member & { user: any };
}) {
  const [activeTab, setActiveTab] = useState("personal-info");

  const tabs = [
    { id: "personal-info", label: "Personal Info", component: PersonalInfoTab },
    { id: "family-info", label: "Family Info", component: FamilyInfoTab },
    {
      id: "background-info",
      label: "Background",
      component: BackgroundInfoTab,
    },
    { id: "address-info", label: "Address", component: AddressInfoTab },
    { id: "identity-info", label: "Identity", component: IdentityInfoTab },
    { id: "sacco-info", label: "SACCO Info", component: SaccoInfoTab },
    {
      id: "recommendation",
      label: "Recommendation",
      component: RecommendationTab,
    },
    { id: "declaration", label: "Declaration", component: DeclarationTab },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="w-full p-0 bg-transparent border-b rounded-none mb-6 relative overflow-x-auto">
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted"></div>
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "py-3 px-4 rounded-none data-[state=active]:shadow-none relative whitespace-nowrap",
                "data-[state=active]:text-primary data-[state=active]:font-medium",
                "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:scale-x-0 data-[state=active]:after:scale-x-100 after:transition-transform"
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </div>
      </TabsList>

      {tabs.map((tab) => {
        const TabComponent = tab.component;
        return (
          <TabsContent key={tab.id} value={tab.id}>
            <TabComponent item={member} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
