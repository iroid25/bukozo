// // app/dashboard/agents/[id]/AgentDetailsView.tsx
// "use client";
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// import {
//   ArrowLeft,
//   User,
//   Mail,
//   Phone,
//   MapPin,
//   Calendar,
//   Building,
//   Edit,
//   Settings,
//   Activity,
//   Clock,
//   Wallet,
// } from "lucide-react";
// import { formatISODate } from "@/lib/utils";
// import { UserRole } from "@prisma/client";
// import { toast } from "sonner";

// interface AgentDetailsViewProps {
//   agent: {
//     id: string;
//     name: string;
//     firstName?: string | null;
//     lastName?: string | null;
//     email: string;
//     phone?: string | null;
//     image?: string | null;
//     role: UserRole;
//     isActive: boolean;
//     isVerified?: boolean | null;
//     areaOfOperation?: string | null;
//     jobTitle?: string | null;
//     createdAt: Date;
//     updatedAt?: Date;
//     branchId?: string | null;
//     userFloat?: {
//       id: string;
//       balance: number;
//       lastReconciliation?: Date | null;
//       isActiveForDay: boolean;
//     } | null;
//   };
//   currentUser: {
//     id: string;
//     role: string;
//     branchId?: string | null;
//   } | null;
//   branches: Array<{
//     id: string;
//     name: string;
//     location: string;
//   }>;
// }

// export default function AgentDetailsView({
//   agent,
//   currentUser,
//   branches,
// }: AgentDetailsViewProps) {
//   const router = useRouter();

//   // Get agent's branch info
//   const agentBranch = branches.find((branch) => branch.id === agent.branchId);

//   // Check if current user can edit this agent
//   const canEdit =
//     currentUser &&
//     (currentUser.role === "ADMIN" ||
//       currentUser.role === "MANAGER" ||
//       currentUser.id === agent.id);

//   const handleEdit = () => {
//     router.push(`/dashboard/agents/${agent.id}/edit`);
//   };

//   const handleBack = () => {
//     router.back();
//   };

//   // Get initials for avatar fallback
//   const getInitials = (name: string) => {
//     return name
//       .split(" ")
//       .map((word) => word.charAt(0).toUpperCase())
//       .slice(0, 2)
//       .join("");
//   };

//   // Format role display
//   const getRoleDisplay = (role: UserRole) => {
//     const roleMap = {
//       TELLER: "Teller",
//       MANAGER: "Manager",
//       ADMIN: "Administrator",
//       AGENT: "Agent",
//       MEMBER: "Member",
//       ACCOUNTANT: "Accountant",
//       LOANOFFICER: "Loan Officer",
//       AUDITOR: "Auditor",
//     };
//     return roleMap[role] || role;
//   };

//   // Get role badge color
//   const getRoleBadgeColor = (role: UserRole) => {
//     const colorMap = {
//       ADMIN: "bg-red-100 text-red-800",
//       MANAGER: "bg-blue-100 text-blue-800",
//       TELLER: "bg-green-100 text-green-800",
//       AGENT: "bg-purple-100 text-purple-800",
//       MEMBER: "bg-gray-100 text-gray-800",
//       ACCOUNTANT: "bg-yellow-100 text-yellow-800",
//       LOANOFFICER: "bg-indigo-100 text-indigo-800",
//       AUDITOR: "bg-pink-100 text-pink-800",
//     };
//     return colorMap[role] || "bg-gray-100 text-gray-800";
//   };

//   // Format currency
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   return (
//     <div className="container mx-auto py-6 max-w-4xl">
//       {/* Header */}
//       <div className="flex items-center justify-between mb-6">
//         <div className="flex items-center gap-4">
//           <Button variant="outline" size="sm" onClick={handleBack}>
//             <ArrowLeft className="h-4 w-4 mr-2" />
//             Back
//           </Button>
//           <div>
//             <h1 className="text-2xl font-bold">Agent Details</h1>
//             <p className="text-gray-600">View and manage agent information</p>
//           </div>
//         </div>
//         {canEdit && (
//           <Button onClick={handleEdit} className="gap-2">
//             <Edit className="h-4 w-4" />
//             Edit Profile
//           </Button>
//         )}
//       </div>

//       <div className="grid gap-6">
//         {/* Profile Overview */}
//         <Card>
//           <CardContent className="pt-6">
//             <div className="flex items-start gap-6">
//               <Avatar className="h-24 w-24">
//                 <AvatarImage
//                   src={agent.image || "/avatar.avif"}
//                   alt={agent.name}
//                 />
//                 <AvatarFallback className="text-lg">
//                   {getInitials(agent.name)}
//                 </AvatarFallback>
//               </Avatar>

//               <div className="flex-1">
//                 <div className="flex items-center justify-between mb-4">
//                   <div>
//                     <h2 className="text-2xl font-bold">{agent.name}</h2>
//                     <p className="text-gray-600 text-lg">
//                       {agent.jobTitle || getRoleDisplay(agent.role)}
//                     </p>
//                   </div>
//                   <div className="flex gap-2">
//                     <Badge
//                       className={getRoleBadgeColor(agent.role)}
//                       variant="secondary"
//                     >
//                       {getRoleDisplay(agent.role)}
//                     </Badge>
//                     <Badge variant={agent.isActive ? "default" : "destructive"}>
//                       {agent.isActive ? "Active" : "Inactive"}
//                     </Badge>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <div className="flex items-center gap-2 text-gray-600">
//                     <Mail className="h-4 w-4" />
//                     <span>{agent.email}</span>
//                   </div>
//                   {agent.phone && (
//                     <div className="flex items-center gap-2 text-gray-600">
//                       <Phone className="h-4 w-4" />
//                       <span>{agent.phone}</span>
//                     </div>
//                   )}
//                   {agentBranch && (
//                     <div className="flex items-center gap-2 text-gray-600">
//                       <Building className="h-4 w-4" />
//                       <span>{agentBranch.name}</span>
//                     </div>
//                   )}
//                   {agent.areaOfOperation && (
//                     <div className="flex items-center gap-2 text-gray-600">
//                       <MapPin className="h-4 w-4" />
//                       <span>{agent.areaOfOperation}</span>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Account Information & Float Balance */}
//         <div className="grid md:grid-cols-2 gap-6">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <User className="h-5 w-5 text-blue-600" />
//                 Account Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <div className="space-y-3">
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">User ID:</span>
//                   <span className="font-mono text-sm">{agent.id}</span>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Email Verified:</span>
//                   <Badge
//                     variant={agent.isVerified ? "default" : "secondary"}
//                     className={
//                       agent.isVerified
//                         ? "bg-green-100 text-green-800"
//                         : "bg-yellow-100 text-yellow-800"
//                     }
//                   >
//                     {agent.isVerified ? "Verified" : "Unverified"}
//                   </Badge>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Account Status:</span>
//                   <Badge variant={agent.isActive ? "default" : "destructive"}>
//                     {agent.isActive ? "Active" : "Inactive"}
//                   </Badge>
//                 </div>
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Role:</span>
//                   <Badge
//                     className={getRoleBadgeColor(agent.role)}
//                     variant="secondary"
//                   >
//                     {getRoleDisplay(agent.role)}
//                   </Badge>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Wallet className="h-5 w-5 text-purple-600" />
//                 Float Information
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {agent.userFloat ? (
//                 <div className="space-y-3">
//                   <div className="flex justify-between">
//                     <span className="text-gray-600">Float Balance:</span>
//                     <span className="font-bold text-lg text-purple-700">
//                       {formatCurrency(agent.userFloat.balance)}
//                     </span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="text-gray-600">Day Status:</span>
//                     <Badge
//                       variant={
//                         agent.userFloat.isActiveForDay ? "default" : "secondary"
//                       }
//                       className={
//                         agent.userFloat.isActiveForDay
//                           ? "bg-green-100 text-green-800"
//                           : "bg-gray-100 text-gray-800"
//                       }
//                     >
//                       {agent.userFloat.isActiveForDay ? "Active" : "Inactive"}
//                     </Badge>
//                   </div>
//                   {agent.userFloat.lastReconciliation && (
//                     <div className="flex justify-between">
//                       <span className="text-gray-600">
//                         Last Reconciliation:
//                       </span>
//                       <span className="text-sm">
//                         {formatISODate(agent.userFloat.lastReconciliation)}
//                       </span>
//                     </div>
//                   )}
//                 </div>
//               ) : (
//                 <div className="text-center py-4">
//                   <p className="text-gray-400">No float assigned</p>
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </div>

//         {/* Work Information */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Building className="h-5 w-5 text-green-600" />
//               Work Information
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {agentBranch ? (
//                 <>
//                   <div className="flex justify-between">
//                     <span className="text-gray-600">Branch:</span>
//                     <span className="font-medium">{agentBranch.name}</span>
//                   </div>
//                   <div className="flex justify-between">
//                     <span className="text-gray-600">Location:</span>
//                     <span className="font-medium">{agentBranch.location}</span>
//                   </div>
//                 </>
//               ) : (
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Branch:</span>
//                   <span className="text-gray-400">Not assigned</span>
//                 </div>
//               )}

//               {agent.jobTitle && (
//                 <div className="flex justify-between">
//                   <span className="text-gray-600">Job Title:</span>
//                   <span className="font-medium">{agent.jobTitle}</span>
//                 </div>
//               )}

//               {agent.areaOfOperation && (
//                 <div className="flex justify-between md:col-span-2">
//                   <span className="text-gray-600">Area of Operation:</span>
//                   <span className="font-medium">{agent.areaOfOperation}</span>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Activity Timeline */}
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Activity className="h-5 w-5 text-purple-600" />
//               Account Timeline
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="space-y-4">
//               <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
//                 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
//                   <Calendar className="h-4 w-4" />
//                 </div>
//                 <div className="flex-1">
//                   <p className="font-medium text-blue-900">Account Created</p>
//                   <p className="text-sm text-blue-700">
//                     {formatISODate(agent.createdAt)}
//                   </p>
//                 </div>
//               </div>

//               {agent.updatedAt && (
//                 <div className="flex items-center gap-4 p-3 bg-green-50 rounded-lg">
//                   <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
//                     <Clock className="h-4 w-4" />
//                   </div>
//                   <div className="flex-1">
//                     <p className="font-medium text-green-900">Last Updated</p>
//                     <p className="text-sm text-green-700">
//                       {formatISODate(agent.updatedAt)}
//                     </p>
//                   </div>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Quick Actions */}
//         {canEdit && (
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Settings className="h-5 w-5 text-gray-600" />
//                 Quick Actions
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="flex gap-3 flex-wrap">
//                 <Button
//                   variant="outline"
//                   onClick={handleEdit}
//                   className="gap-2"
//                 >
//                   <Edit className="h-4 w-4" />
//                   Edit Profile
//                 </Button>

//                 <Button
//                   variant="outline"
//                   onClick={() => {
//                     navigator.clipboard.writeText(agent.email);
//                     toast.success("Email copied to clipboard");
//                   }}
//                   className="gap-2"
//                 >
//                   <Mail className="h-4 w-4" />
//                   Copy Email
//                 </Button>

//                 {agent.phone && (
//                   <Button
//                     variant="outline"
//                     onClick={() => {
//                       navigator.clipboard.writeText(agent.phone || "");
//                       toast.success("Phone number copied to clipboard");
//                     }}
//                     className="gap-2"
//                   >
//                     <Phone className="h-4 w-4" />
//                     Copy Phone
//                   </Button>
//                 )}
//               </div>
//             </CardContent>
//           </Card>
//         )}
//       </div>
//     </div>
//   );
// }
