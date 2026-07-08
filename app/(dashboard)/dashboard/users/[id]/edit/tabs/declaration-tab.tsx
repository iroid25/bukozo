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
// import { toast } from "sonner";
// import { updateMemberById } from "@/actions/update-member";
// import { Member } from "@/types/member";

// export function DeclarationTab({ item }: { item: Member & { user: any } }) {
//   return (
//     <div className="grid gap-6 mt-6">
//       <DeclarationCard item={item} />
//       <OfficialUseCard item={item} />
//     </div>
//   );
// }

// function DeclarationCard({ item }: { item: Member & { user: any } }) {
//   const [entryFee, setEntryFee] = useState(item.entryFee?.toString() || "");
//   const [initialSavings, setInitialSavings] = useState(
//     item.initialSavings?.toString() || ""
//   );
//   const [nominee, setNominee] = useState(item.nominee || "");
//   const [isUpdating, setIsUpdating] = useState(false);

//   const handleUpdate = async () => {
//     setIsUpdating(true);

//     try {
//       const data = {
//         entryFee: entryFee ? parseFloat(entryFee) : undefined,
//         initialSavings: initialSavings ? parseFloat(initialSavings) : undefined,
//         nominee: nominee || undefined,
//       };

//       const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
//       toast.success("Declaration updated successfully");
//     } catch (error) {
//       toast.error("Failed to update declaration");
//       console.error(error);
//     } finally {
//       setIsUpdating(false);
//     }
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Member Declaration</CardTitle>
//       </CardHeader>
//       <CardContent className="grid gap-6">
//         <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
//           <h4 className="font-medium text-blue-800 mb-2">
//             Declaration Statement:
//           </h4>
//           <p className="text-sm text-blue-700">
//             "If application is accepted, I/we agree to pay an entry fee and
//             initial savings deposit as specified below. I also agree to abide by
//             the existing constitution, bye-laws, policies, rules and
//             regulations; and amendments and policies/bye laws that shall be made
//             and accepted by members of the society."
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           <div className="grid gap-3">
//             <Label htmlFor="entryFee">Entry Fee (UGX)</Label>
//             <Input
//               id="entryFee"
//               type="number"
//               value={entryFee}
//               onChange={(e) => setEntryFee(e.target.value)}
//               placeholder="Enter entry fee amount"
//               step="0.01"
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="initialSavings">
//               Initial Savings Deposit (UGX)
//             </Label>
//             <Input
//               id="initialSavings"
//               type="number"
//               value={initialSavings}
//               onChange={(e) => setInitialSavings(e.target.value)}
//               placeholder="Enter initial deposit"
//               step="0.01"
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="nominee">Nominee (In case of death)</Label>
//             <Input
//               id="nominee"
//               value={nominee}
//               onChange={(e) => setNominee(e.target.value)}
//               placeholder="Name of nominee"
//             />
//           </div>
//         </div>

//         <div className="bg-green-50 border border-green-200 rounded-lg p-4">
//           <h4 className="font-medium text-green-800 mb-2">
//             Benefits of Membership:
//           </h4>
//           <div className="text-sm text-green-700 space-y-1">
//             <p>• Access to savings accounts with competitive interest rates</p>
//             <p>• Eligibility for loans at affordable rates</p>
//             <p>• Financial literacy training and education</p>
//             <p>• Dividend payments based on annual performance</p>
//             <p>• Insurance coverage and protection schemes</p>
//           </div>
//         </div>
//       </CardContent>
//       <CardFooter>
//         <Button onClick={handleUpdate} disabled={isUpdating}>
//           {isUpdating ? "Updating..." : "Update Declaration"}
//         </Button>
//       </CardFooter>
//     </Card>
//   );
// }

// function OfficialUseCard({ item }: { item: Member & { user: any } }) {
//   const [savingsAccountNumber, setSavingsAccountNumber] = useState(
//     item.savingsAccountNumber || ""
//   );
//   const [rejectionReason, setRejectionReason] = useState(
//     item.rejectionReason || ""
//   );
//   const [approvalDate, setApprovalDate] = useState(
//     item.approvalDate
//       ? new Date(item.approvalDate).toISOString().split("T")[0]
//       : ""
//   );
//   const [isUpdating, setIsUpdating] = useState(false);

//   const handleUpdate = async () => {
//     setIsUpdating(true);

//     try {
//       const data = {
//         savingsAccountNumber: savingsAccountNumber || undefined,
//         rejectionReason: rejectionReason || undefined,
//         approvalDate: approvalDate ? new Date(approvalDate) : undefined,
//       };

//       const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
//       toast.success("Official information updated successfully");
//     } catch (error) {
//       toast.error("Failed to update official information");
//       console.error(error);
//     } finally {
//       setIsUpdating(false);
//     }
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>For Official Use Only</CardTitle>
//       </CardHeader>
//       <CardContent className="grid gap-6">
//         <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
//           <h4 className="font-medium text-red-800 mb-2">
//             ⚠️ Admin Only Section
//           </h4>
//           <p className="text-sm text-red-700">
//             This section is reserved for SACCO management and authorized
//             personnel only.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           <div className="grid gap-3">
//             <Label htmlFor="savingsAccountNumber">Savings Account Number</Label>
//             <Input
//               id="savingsAccountNumber"
//               value={savingsAccountNumber}
//               onChange={(e) => setSavingsAccountNumber(e.target.value)}
//               placeholder="Allocated account number"
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="approvalDate">Approval/Rejection Date</Label>
//             <Input
//               id="approvalDate"
//               type="date"
//               value={approvalDate}
//               onChange={(e) => setApprovalDate(e.target.value)}
//             />
//           </div>

//           <div className="grid gap-3">
//             <Label htmlFor="rejectionReason">
//               Rejection Reason (if applicable)
//             </Label>
//             <Input
//               id="rejectionReason"
//               value={rejectionReason}
//               onChange={(e) => setRejectionReason(e.target.value)}
//               placeholder="Reason for rejection"
//             />
//           </div>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <div className="space-y-2">
//             <Label>Current Status</Label>
//             <div
//               className={`px-3 py-2 rounded-lg text-sm font-medium ${
//                 item.isApproved
//                   ? "bg-green-100 text-green-800"
//                   : "bg-yellow-100 text-yellow-800"
//               }`}
//             >
//               {item.isApproved ? "✅ Approved" : "⏳ Pending Approval"}
//             </div>
//           </div>

//           <div className="space-y-2">
//             <Label>Member Number</Label>
//             <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono">
//               {item.memberNumber}
//             </div>
//           </div>
//         </div>

//         <div className="bg-gray-50 border rounded-lg p-4">
//           <h4 className="font-medium text-gray-800 mb-2">
//             Required Signatures & Stamps:
//           </h4>
//           <div className="text-sm text-gray-600 space-y-1">
//             <p>• Manager Signature: ________________</p>
//             <p>• Cashier Signature: ________________</p>
//             <p>• Official Stamp: Required</p>
//             <p>• Date: ________________</p>
//           </div>
//         </div>
//       </CardContent>
//       <CardFooter>
//         <Button onClick={handleUpdate} disabled={isUpdating}>
//           {isUpdating ? "Updating..." : "Update Official Information"}
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
import { toast } from "sonner";


// Use Prisma generated types
import { Prisma } from "@prisma/client";

// Type for Member with User relation
type MemberWithUser = Prisma.MemberGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        role: true;
      };
    };
  };
}>;

export function DeclarationTab({ item }: { item: MemberWithUser }) {
  return (
    <div className="grid gap-6 mt-6">
      <DeclarationCard item={item} />
      <OfficialUseCard item={item} />
    </div>
  );
}

function DeclarationCard({ item }: { item: MemberWithUser }) {
  const [entryFee, setEntryFee] = useState(item.entryFee?.toString() || "");
  const [initialSavings, setInitialSavings] = useState(
    item.initialSavings?.toString() || ""
  );
  const [nominee, setNominee] = useState(item.nominee || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        entryFee: entryFee ? parseFloat(entryFee) : undefined,
        initialSavings: initialSavings ? parseFloat(initialSavings) : undefined,
        nominee: nominee || undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Declaration updated successfully");
    } catch (error) {
      toast.error("Failed to update declaration");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Member Declaration</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-800 mb-2">
            Declaration Statement:
          </h4>
          <p className="text-sm text-blue-700">
            "If application is accepted, I/we agree to pay an entry fee and
            initial savings deposit as specified below. I also agree to abide by
            the existing constitution, bye-laws, policies, rules and
            regulations; and amendments and policies/bye laws that shall be made
            and accepted by members of the society."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="entryFee">Entry Fee (UGX)</Label>
            <Input
              id="entryFee"
              type="number"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              placeholder="Enter entry fee amount"
              step="0.01"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="initialSavings">
              Initial Savings Deposit (UGX)
            </Label>
            <Input
              id="initialSavings"
              type="number"
              value={initialSavings}
              onChange={(e) => setInitialSavings(e.target.value)}
              placeholder="Enter initial deposit"
              step="0.01"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="nominee">Nominee (In case of death)</Label>
            <Input
              id="nominee"
              value={nominee}
              onChange={(e) => setNominee(e.target.value)}
              placeholder="Name of nominee"
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">
            Benefits of Membership:
          </h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>• Access to savings accounts with competitive interest rates</p>
            <p>• Eligibility for loans at affordable rates</p>
            <p>• Financial literacy training and education</p>
            <p>• Dividend payments based on annual performance</p>
            <p>• Insurance coverage and protection schemes</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Declaration"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function OfficialUseCard({ item }: { item: MemberWithUser }) {
  const [savingsAccountNumber, setSavingsAccountNumber] = useState(
    item.savingsAccountNumber || ""
  );
  const [rejectionReason, setRejectionReason] = useState(
    item.rejectionReason || ""
  );
  const [approvalDate, setApprovalDate] = useState(
    item.approvalDate
      ? new Date(item.approvalDate).toISOString().split("T")[0]
      : ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      const data = {
        savingsAccountNumber: savingsAccountNumber || undefined,
        rejectionReason: rejectionReason || undefined,
        approvalDate: approvalDate ? new Date(approvalDate) : undefined,
      };

      const _res = await fetch(`/api/v1/members/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!_res.ok) { const _json = await _res.json(); throw new Error(_json.error || "Update failed"); }
      toast.success("Official information updated successfully");
    } catch (error) {
      toast.error("Failed to update official information");
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>For Official Use Only</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-red-800 mb-2">
            ⚠️ Admin Only Section
          </h4>
          <p className="text-sm text-red-700">
            This section is reserved for SACCO management and authorized
            personnel only.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="grid gap-3">
            <Label htmlFor="savingsAccountNumber">Savings Account Number</Label>
            <Input
              id="savingsAccountNumber"
              value={savingsAccountNumber}
              onChange={(e) => setSavingsAccountNumber(e.target.value)}
              placeholder="Allocated account number"
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="approvalDate">Approval/Rejection Date</Label>
            <Input
              id="approvalDate"
              type="date"
              value={approvalDate}
              onChange={(e) => setApprovalDate(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="rejectionReason">
              Rejection Reason (if applicable)
            </Label>
            <Input
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div
              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                item.isApproved
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {item.isApproved ? "✅ Approved" : "⏳ Pending Approval"}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Member Number</Label>
            <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono">
              {item.memberNumber}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="font-medium text-gray-800 mb-2">
            Required Signatures & Stamps:
          </h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Manager Signature: ________________</p>
            <p>• Cashier Signature: ________________</p>
            <p>• Official Stamp: Required</p>
            <p>• Date: ________________</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? "Updating..." : "Update Official Information"}
        </Button>
      </CardFooter>
    </Card>
  );
}
