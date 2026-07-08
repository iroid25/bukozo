// "use client";

// import { useState } from "react";
// import {
//   Card,
//   CardContent,
//   CardFooter,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import { toast } from "sonner";
// import { updateMemberById } from "@/actions/update-member";
// import { Member } from "@/types/member";

// export function BackgroundInfoTab({ item }: { item: Member & { user: any } }) {
//   return (
//     <div className="grid gap-6 mt-6">
//       <EducationOccupationCard item={item} />
//     </div>
//   );
// }

// function EducationOccupationCard({ item }: { item: Member & { user: any } }) {
//   const [levelOfEducation, setLevelOfEducation] = useState(
//     item.levelOfEducation || ""
//   );
//   const [citizenship, setCitizenship] = useState(item.citizenship || "");
//   const [occupation, setOccupation] = useState(item.occupation || "");
//   const [otherFinancialInstitutions, setOtherFinancialInstitutions] = useState(
//     item.otherFinancialInstitutions || ""
//   );
//   const [isUpdating, setIsUpdating] = useState(false);

//   const handleUpdate = async () => {
//     setIsUpdating(true);

//     try {
//       const data = {
//         levelOfEducation: levelOfEducation || undefined,
//         citizenship: citizenship || undefined,
//         occupation: occupation || undefined,
//         otherFinancialInstitutions: otherFinancialInstitutions || undefined,
//       };

//       const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
//       toast.success("Background information updated successfully");
//     } catch (error) {
//       toast.error("Failed to update background information");
//       console.error(error);
//     } finally {
//       setIsUpdating(false);
//     }
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Education & Professional Background</CardTitle>
//       </CardHeader>
//       <CardContent className="grid gap-6">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           <div className="grid gap-3">
//             <Label htmlFor="levelOfEducation">Level of Education</Label>
//             <Input
//               id="levelOfEducation"
//               value={levelOfEducation}
//               onChange={(e) => setLevelOfEducation(e.target.value)}
//               placeholder="e.g., Bachelor's Degree"
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="citizenship">Citizenship</Label>
//             <Input
//               id="citizenship"
//               value={citizenship}
//               onChange={(e) => setCitizenship(e.target.value)}
//               placeholder="e.g., Ugandan"
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="occupation">Occupation</Label>
//             <Input
//               id="occupation"
//               value={occupation}
//               onChange={(e) => setOccupation(e.target.value)}
//               placeholder="e.g., Teacher"
//             />
//           </div>

//           <div className="grid gap-3 md:col-span-2 lg:col-span-3">
//             <Label htmlFor="otherFinancialInstitutions">
//               Other Financial Institutions
//             </Label>
//             <Textarea
//               id="otherFinancialInstitutions"
//               value={otherFinancialInstitutions}
//               onChange={(e) => setOtherFinancialInstitutions(e.target.value)}
//               placeholder="List other financial institutions where you are a member/client/customer"
//               rows={3}
//             />
//           </div>
//         </div>
//       </CardContent>
//       <CardFooter>
//         <Button onClick={handleUpdate} disabled={isUpdating}>
//           {isUpdating ? "Updating..." : "Update Background Information"}
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// }

"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";


// Option 1: Define the complete Member interface locally
interface CompleteMember {
  id: string;
  userId: string;
  // Address fields
  village?: string | null;
  parish?: string | null;
  subCounty?: string | null;
  constituency?: string | null;
  town?: string | null;
  district?: string | null;
  postalAddress?: string | null;
  // Background/Education fields
  levelOfEducation?: string | null;
  citizenship?: string | null;
  occupation?: string | null;
  otherFinancialInstitutions?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
  };
}

// Option 2: Use Prisma types (if you're using Prisma)
// import { Prisma } from "@prisma/client";
// type MemberWithUser = Prisma.MemberGetPayload<{
//   include: {
//     user: {
//       select: {
//         id: true;
//         name: true;
//         email: true;
//         phone: true;
//         role: true;
//       };
//     };
//   };
// }>;

export function BackgroundInfoTab({ item }: { item: CompleteMember }) {
  return (
    <div className="grid gap-6 mt-6">
      <EducationOccupationCard item={item} />
    </div>
  );
}

function EducationOccupationCard({ item }: { item: CompleteMember }) {
  const [levelOfEducation, setLevelOfEducation] = useState(
    item.levelOfEducation || ""
  );
  const [citizenship, setCitizenship] = useState(item.citizenship || "");
  const [occupation, setOccupation] = useState(item.occupation || "");
  const [otherFinancialInstitutions, setOtherFinancialInstitutions] = useState(
    item.otherFinancialInstitutions || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        levelOfEducation: levelOfEducation || undefined,
        citizenship: citizenship || undefined,
        occupation: occupation || undefined,
        otherFinancialInstitutions: otherFinancialInstitutions || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Background information updated successfully");
    } catch (error) {
      toast.error("Failed to update background information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Education & Professional Background</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="levelOfEducation">Level of Education</Label>
            <Input
              id="levelOfEducation"
              value={levelOfEducation}
              onChange={(e) => setLevelOfEducation(e.target.value)}
              placeholder="e.g., Bachelor's Degree"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="citizenship">Citizenship</Label>
            <Input
              id="citizenship"
              value={citizenship}
              onChange={(e) => setCitizenship(e.target.value)}
              placeholder="e.g., Ugandan"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="occupation">Occupation</Label>
            <Input
              id="occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              placeholder="e.g., Teacher"
            />
          </div>

          <div className="grid gap-3 md:col-span-2 lg:col-span-3">
            <Label htmlFor="otherFinancialInstitutions">
              Other Financial Institutions
            </Label>
            <Textarea
              id="otherFinancialInstitutions"
              value={otherFinancialInstitutions}
              onChange={(e) => setOtherFinancialInstitutions(e.target.value)}
              placeholder="List other financial institutions where you are a member/client/customer"
              rows={3}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Background Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
