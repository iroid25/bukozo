// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import {
//   User as UserIcon,
//   Mail,
//   Phone,
//   MapPin,
//   Building,
//   Activity,
//   DollarSign,
//   Clock,
//   Edit,
//   CheckCircle,
//   XCircle,
//   TrendingUp,
//   TrendingDown,
//   ArrowLeft,
//   Shield,
//   AlertCircle,
// } from "lucide-react";

// import { formatISODate } from "@/lib/utils";
// import Link from "next/link";
// import { toggleUserStatus } from "@/actions/users";

// interface UserDetailClientProps {
//   user: any;
//   currentUser: any;
//   recentActivity: any[];
//   floatTransactions: any[];
// }

// export default function UserDetailClient({
//   user,
//   currentUser,
//   recentActivity,
//   floatTransactions,
// }: UserDetailClientProps) {
//   const router = useRouter();
//   const [activeTab, setActiveTab] = useState("overview");
//   const [isTogglingStatus, setIsTogglingStatus] = useState(false);

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   const formatDateTime = (dateString: string | Date) => {
//     if (!dateString) return "N/A";
//     return new Date(dateString).toLocaleString("en-US", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//       hour: "2-digit",
//       minute: "2-digit",
//     });
//   };

//   const getRoleBadgeColor = (role: string) => {
//     const colors: Record<string, string> = {
//       ADMIN: "bg-purple-100 text-purple-800",
//       BRANCHMANAGER: "bg-blue-100 text-blue-800",
//       TELLER: "bg-green-100 text-green-800",
//       AGENT: "bg-orange-100 text-orange-800",
//       ACCOUNTANT: "bg-indigo-100 text-indigo-800",
//       LOANOFFICER: "bg-cyan-100 text-cyan-800",
//       AUDITOR: "bg-pink-100 text-pink-800",
//       MEMBER: "bg-gray-100 text-gray-800",
//     };
//     return colors[role] || "bg-gray-100 text-gray-800";
//   };

//   const handleToggleStatus = async () => {
//     if (isTogglingStatus) return;

//     setIsTogglingStatus(true);
//     const { error } = await toggleUserStatus(user.id);

//     if (error) {
//       toast.error("Failed to update status", {
//         description: error,
//       });
//     } else {
//       toast.success(
//         `User ${!user.isActive ? "activated" : "deactivated"} successfully`
//       );
//       router.refresh();
//     }

//     setIsTogglingStatus(false);
//   };

//   const handleEdit = () => {
//     const role = user.role.toLowerCase();
//     router.push(`/dashboard/users/${role}s/${user.id}/edit`);
//   };

//   // Calculate stats from actual data with null safety
//   const stats = {
//     totalTransactions:
//       (user.deposits?.length || 0) +
//       (user.withdrawals?.length || 0) +
//       (user.loanRepayments?.length || 0) +
//       (user.transactions?.length || 0),
//     totalDeposits: user.deposits?.length || 0,
//     totalWithdrawals: user.withdrawals?.length || 0,
//     totalAmount:
//       (user.deposits?.reduce(
//         (sum: number, d: any) => sum + (d.amount || 0),
//         0
//       ) || 0) +
//       (user.withdrawals?.reduce(
//         (sum: number, w: any) => sum + (w.amount || 0),
//         0
//       ) || 0),
//   };

//   const canEdit =
//     currentUser.id === user.id ||
//     ["ADMIN", "BRANCHMANAGER", "ACCOUNTANT"].includes(currentUser.role);

//   const tabs = [
//     { id: "overview", label: "Overview", icon: UserIcon },
//     { id: "activity", label: "Activity", icon: Activity },
//     {
//       id: "float",
//       label: "Float Management",
//       icon: DollarSign,
//       roles: ["TELLER", "AGENT"],
//     },
//     { id: "permissions", label: "Permissions", icon: Shield },
//   ];

//   const visibleTabs = tabs.filter(
//     (tab) => !tab.roles || tab.roles.includes(user.role)
//   );

//   return (
//     <div className="min-h-screen bg-gray-50 p-6">
//       {/* Header Section */}
//       <div className="mb-6">
//         <div className="flex items-center justify-between">
//           <div>
//             <div className="flex items-center gap-3 mb-2">
//               <Link
//                 href={`/dashboard/users/${user.role.toLowerCase()}s`}
//                 className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
//               >
//                 <ArrowLeft className="h-5 w-5 text-gray-600" />
//               </Link>
//               <div>
//                 <h1 className="text-3xl font-bold text-gray-900">
//                   User Profile
//                 </h1>
//                 <p className="text-gray-600 mt-1">
//                   Detailed information and activity
//                 </p>
//               </div>
//             </div>
//           </div>
//           {canEdit && (
//             <div className="flex gap-3">
//               <button
//                 onClick={handleToggleStatus}
//                 disabled={isTogglingStatus}
//                 className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
//                   user.isActive
//                     ? "bg-white border-gray-300 hover:bg-gray-50 text-gray-700"
//                     : "bg-green-50 border-green-300 hover:bg-green-100 text-green-700"
//                 }`}
//               >
//                 {user.isActive ? (
//                   <XCircle className="h-4 w-4" />
//                 ) : (
//                   <CheckCircle className="h-4 w-4" />
//                 )}
//                 {isTogglingStatus
//                   ? "Updating..."
//                   : user.isActive
//                   ? "Deactivate"
//                   : "Activate"}
//               </button>
//               <button
//                 onClick={handleEdit}
//                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
//               >
//                 <Edit className="h-4 w-4" />
//                 Edit Profile
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Profile Card */}
//       <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
//         <div className="flex items-start gap-6">
//           {/* Profile Image */}
//           <div className="relative">
//             <img
//               src={user.image || "/avatar.avif"}
//               alt={user.name}
//               className="h-32 w-32 rounded-full object-cover border-4 border-gray-100"
//             />
//             <div
//               className={`absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-white ${
//                 user.isActive ? "bg-green-500" : "bg-red-500"
//               }`}
//             />
//           </div>

//           {/* Basic Info */}
//           <div className="flex-1">
//             <div className="flex items-start justify-between">
//               <div>
//                 <h2 className="text-2xl font-bold text-gray-900">
//                   {user.name}
//                 </h2>
//                 <p className="text-gray-600 mt-1">
//                   {user.jobTitle || user.role.replace("_", " ")}
//                 </p>
//               </div>
//               <div className="flex gap-2">
//                 <span
//                   className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(
//                     user.role
//                   )}`}
//                 >
//                   {user.role.replace("_", " ")}
//                 </span>
//                 <span
//                   className={`px-3 py-1 rounded-full text-sm font-medium ${
//                     user.isActive
//                       ? "bg-green-100 text-green-800"
//                       : "bg-red-100 text-red-800"
//                   }`}
//                 >
//                   {user.isActive ? (
//                     <span className="flex items-center gap-1">
//                       <CheckCircle className="h-4 w-4" />
//                       Active
//                     </span>
//                   ) : (
//                     <span className="flex items-center gap-1">
//                       <XCircle className="h-4 w-4" />
//                       Inactive
//                     </span>
//                   )}
//                 </span>
//               </div>
//             </div>

//             {/* Contact Grid */}
//             <div className="grid grid-cols-2 gap-4 mt-6">
//               <div className="flex items-center gap-3">
//                 <div className="p-2 bg-blue-50 rounded-lg">
//                   <Mail className="h-5 w-5 text-blue-600" />
//                 </div>
//                 <div>
//                   <p className="text-xs text-gray-500">Email</p>
//                   <p className="text-sm font-medium text-gray-900">
//                     {user.email}
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-center gap-3">
//                 <div className="p-2 bg-green-50 rounded-lg">
//                   <Phone className="h-5 w-5 text-green-600" />
//                 </div>
//                 <div>
//                   <p className="text-xs text-gray-500">Phone</p>
//                   <p className="text-sm font-medium text-gray-900">
//                     {user.phone || "N/A"}
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-center gap-3">
//                 <div className="p-2 bg-purple-50 rounded-lg">
//                   <Building className="h-5 w-5 text-purple-600" />
//                 </div>
//                 <div>
//                   <p className="text-xs text-gray-500">Branch</p>
//                   <p className="text-sm font-medium text-gray-900">
//                     {user.branch?.name || "N/A"}
//                   </p>
//                 </div>
//               </div>

//               <div className="flex items-center gap-3">
//                 <div className="p-2 bg-orange-50 rounded-lg">
//                   <MapPin className="h-5 w-5 text-orange-600" />
//                 </div>
//                 <div>
//                   <p className="text-xs text-gray-500">Area of Operation</p>
//                   <p className="text-sm font-medium text-gray-900">
//                     {user.areaOfOperation || user.branch?.location || "N/A"}
//                   </p>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Stats Cards */}
//       {(user.role === "TELLER" || user.role === "AGENT") && (
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-sm text-gray-600">Total Transactions</p>
//               <Activity className="h-5 w-5 text-blue-600" />
//             </div>
//             <p className="text-2xl font-bold text-gray-900">
//               {stats.totalTransactions}
//             </p>
//           </div>

//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-sm text-gray-600">Deposits Handled</p>
//               <TrendingUp className="h-5 w-5 text-green-600" />
//             </div>
//             <p className="text-2xl font-bold text-gray-900">
//               {stats.totalDeposits}
//             </p>
//           </div>

//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-sm text-gray-600">Withdrawals Handled</p>
//               <TrendingDown className="h-5 w-5 text-orange-600" />
//             </div>
//             <p className="text-2xl font-bold text-gray-900">
//               {stats.totalWithdrawals}
//             </p>
//           </div>

//           <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
//             <div className="flex items-center justify-between mb-2">
//               <p className="text-sm text-gray-600">Total Amount</p>
//               <DollarSign className="h-5 w-5 text-purple-600" />
//             </div>
//             <p className="text-2xl font-bold text-gray-900">
//               {formatCurrency(stats.totalAmount)}
//             </p>
//           </div>
//         </div>
//       )}

//       {/* Tabs */}
//       <div className="bg-white rounded-xl shadow-sm border border-gray-200">
//         {/* Tab Headers */}
//         <div className="border-b border-gray-200">
//           <div className="flex gap-1 p-2">
//             {visibleTabs.map((tab) => {
//               const Icon = tab.icon;
//               return (
//                 <button
//                   key={tab.id}
//                   onClick={() => setActiveTab(tab.id)}
//                   className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
//                     activeTab === tab.id
//                       ? "bg-blue-50 text-blue-700 font-medium"
//                       : "text-gray-600 hover:bg-gray-50"
//                   }`}
//                 >
//                   <Icon className="h-4 w-4" />
//                   {tab.label}
//                 </button>
//               );
//             })}
//           </div>
//         </div>

//         {/* Tab Content */}
//         <div className="p-6">
//           {activeTab === "overview" && (
//             <div className="space-y-6">
//               <div>
//                 <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                   Personal Information
//                 </h3>
//                 <div className="grid grid-cols-2 gap-6">
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Full Name</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.firstName} {user.lastName}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">National ID</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.nationalId || "N/A"}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Date of Birth</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.dateOfBirth
//                         ? formatISODate(user.dateOfBirth)
//                         : "N/A"}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Address</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.address || "N/A"}
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               <div className="border-t border-gray-200 pt-6">
//                 <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                   Employment Information
//                 </h3>
//                 <div className="grid grid-cols-2 gap-6">
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Job Title</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.jobTitle || user.role.replace("_", " ")}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Branch</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.branch?.name || "N/A"}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Date Joined</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {formatISODate(user.createdAt)}
//                     </p>
//                   </div>
//                   <div>
//                     <p className="text-sm text-gray-600 mb-1">Last Login</p>
//                     <p className="text-base font-medium text-gray-900">
//                       {user.lastLogin
//                         ? formatDateTime(user.lastLogin)
//                         : "Never"}
//                     </p>
//                   </div>
//                 </div>
//               </div>

//               {user.member && (
//                 <div className="border-t border-gray-200 pt-6">
//                   <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                     Member Information
//                   </h3>
//                   <div className="grid grid-cols-2 gap-6">
//                     <div>
//                       <p className="text-sm text-gray-600 mb-1">
//                         Member Number
//                       </p>
//                       <p className="text-base font-medium text-gray-900">
//                         {user.member.memberNumber}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-600 mb-1">
//                         Registration Date
//                       </p>
//                       <p className="text-base font-medium text-gray-900">
//                         {formatISODate(user.member.registrationDate)}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-600 mb-1">
//                         Approval Status
//                       </p>
//                       <p className="text-base font-medium text-gray-900">
//                         {user.member.isApproved ? (
//                           <span className="text-green-600">Approved</span>
//                         ) : (
//                           <span className="text-yellow-600">Pending</span>
//                         )}
//                       </p>
//                     </div>
//                     <div>
//                       <p className="text-sm text-gray-600 mb-1">
//                         Number of Accounts
//                       </p>
//                       <p className="text-base font-medium text-gray-900">
//                         {user.member.accounts?.length || 0}
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           {activeTab === "activity" && (
//             <div className="space-y-4">
//               <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                 Recent Activity
//               </h3>
//               {recentActivity.length > 0 ? (
//                 <div className="space-y-3">
//                   {recentActivity.map((activity, index) => (
//                     <div
//                       key={index}
//                       className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
//                     >
//                       <div className="p-2 bg-blue-100 rounded-lg">
//                         <Activity className="h-5 w-5 text-blue-600" />
//                       </div>
//                       <div className="flex-1">
//                         <p className="text-sm font-medium text-gray-900 capitalize">
//                           {activity.action}
//                         </p>
//                         <p className="text-xs text-gray-600 mt-1">
//                           {activity.details}
//                         </p>
//                       </div>
//                       <p className="text-xs text-gray-500">
//                         {formatDateTime(activity.timestamp)}
//                       </p>
//                     </div>
//                   ))}
//                 </div>
//               ) : (
//                 <div className="text-center py-12">
//                   <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
//                   <p className="text-gray-600">No recent activity</p>
//                 </div>
//               )}
//             </div>
//           )}

//           {activeTab === "float" && user.userFloat && (
//             <div className="space-y-6">
//               <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
//                 <div className="flex items-center justify-between mb-4">
//                   <h3 className="text-lg font-semibold text-gray-900">
//                     Current Float Balance
//                   </h3>
//                   {user.userFloat.isActiveForDay && (
//                     <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
//                       Active
//                     </span>
//                   )}
//                 </div>
//                 <p className="text-4xl font-bold text-gray-900 mb-4">
//                   {formatCurrency(user.userFloat.balance)}
//                 </p>
//                 <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
//                   {user.userFloat.currentDayStarted && (
//                     <div className="flex items-center gap-2">
//                       <Clock className="h-4 w-4" />
//                       Day Started:{" "}
//                       {formatDateTime(user.userFloat.currentDayStarted)}
//                     </div>
//                   )}
//                   {user.userFloat.lastReconciliation && (
//                     <div className="flex items-center gap-2">
//                       <CheckCircle className="h-4 w-4" />
//                       Last Reconciled:{" "}
//                       {formatDateTime(user.userFloat.lastReconciliation)}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <div>
//                 <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                   Recent Float Transactions
//                 </h3>
//                 {floatTransactions.length > 0 ? (
//                   <div className="space-y-3">
//                     {floatTransactions.map((transaction) => (
//                       <div
//                         key={transaction.id}
//                         className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
//                       >
//                         <div className="flex items-center gap-4">
//                           <div
//                             className={`p-2 rounded-lg ${
//                               transaction.type === "FLOAT_ALLOCATION" ||
//                               transaction.type === "DEPOSIT"
//                                 ? "bg-green-100"
//                                 : "bg-orange-100"
//                             }`}
//                           >
//                             <DollarSign
//                               className={`h-5 w-5 ${
//                                 transaction.type === "FLOAT_ALLOCATION" ||
//                                 transaction.type === "DEPOSIT"
//                                   ? "text-green-600"
//                                   : "text-orange-600"
//                               }`}
//                             />
//                           </div>
//                           <div>
//                             <p className="text-sm font-medium text-gray-900">
//                               {transaction.type.replace(/_/g, " ")}
//                             </p>
//                             <p className="text-xs text-gray-600">
//                               {transaction.description || "No description"}
//                             </p>
//                           </div>
//                         </div>
//                         <div className="text-right">
//                           <p
//                             className={`text-sm font-semibold ${
//                               transaction.type === "FLOAT_ALLOCATION" ||
//                               transaction.type === "DEPOSIT"
//                                 ? "text-green-600"
//                                 : "text-orange-600"
//                             }`}
//                           >
//                             {transaction.type === "FLOAT_ALLOCATION" ||
//                             transaction.type === "DEPOSIT"
//                               ? "+"
//                               : "-"}
//                             {formatCurrency(transaction.amount)}
//                           </p>
//                           <p className="text-xs text-gray-500">
//                             {formatDateTime(transaction.transactionDate)}
//                           </p>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="text-center py-12 bg-gray-50 rounded-lg">
//                     <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-3" />
//                     <p className="text-gray-600">No float transactions yet</p>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}

//           {activeTab === "permissions" && (
//             <div className="space-y-6">
//               <div>
//                 <h3 className="text-lg font-semibold text-gray-900 mb-4">
//                   Role Permissions
//                 </h3>
//                 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
//                   <div className="flex items-start gap-3">
//                     <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
//                     <div>
//                       <p className="text-sm font-medium text-blue-900">
//                         Role: {user.role.replace("_", " ")}
//                       </p>
//                       <p className="text-xs text-blue-700 mt-1">
//                         This user has access to role-specific features and
//                         permissions
//                       </p>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-2 gap-4">
//                   {getRolePermissions(user.role).map((permission) => (
//                     <div
//                       key={permission}
//                       className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
//                     >
//                       <CheckCircle className="h-5 w-5 text-green-600" />
//                       <span className="text-sm text-gray-900">
//                         {permission}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// // Helper function to get permissions based on role
// function getRolePermissions(role: string): string[] {
//   const permissions: Record<string, string[]> = {
//     ADMIN: [
//       "Full System Access",
//       "Manage Users",
//       "Manage Branches",
//       "View All Reports",
//       "System Configuration",
//       "Audit Logs Access",
//       "Approve Transactions",
//       "Manage Roles",
//     ],
//     BRANCHMANAGER: [
//       "Manage Branch Users",
//       "View Branch Reports",
//       "Approve Loans",
//       "Manage Members",
//       "View Transactions",
//       "Reconciliation Oversight",
//     ],
//     TELLER: [
//       "Process Deposits",
//       "Process Withdrawals",
//       "View Member Accounts",
//       "Handle Cash",
//       "Manage Float",
//       "View Transactions",
//     ],
//     AGENT: [
//       "Process Deposits",
//       "Process Withdrawals",
//       "View Member Accounts",
//       "Manage Float",
//       "Create Members",
//       "Field Operations",
//     ],
//     ACCOUNTANT: [
//       "View Financial Reports",
//       "Manage Float Allocations",
//       "Approve Reconciliations",
//       "View All Transactions",
//       "Generate Statements",
//       "Financial Analysis",
//     ],
//     LOANOFFICER: [
//       "Process Loan Applications",
//       "Review Loan Documents",
//       "Approve Loans",
//       "Track Loan Repayments",
//       "Generate Loan Reports",
//       "Member Assessment",
//     ],
//     AUDITOR: [
//       "Access Audit Logs",
//       "View All Transactions",
//       "Generate Audit Reports",
//       "System Compliance Review",
//       "Financial Verification",
//       "Risk Assessment",
//     ],
//     MEMBER: [
//       "View Own Accounts",
//       "View Transactions",
//       "Apply for Loans",
//       "Make Deposits",
//       "Request Withdrawals",
//       "View Statements",
//     ],
//   };

//   return permissions[role] || ["Basic Access"];
// }
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X } from "lucide-react";

// Proper TypeScript types
type UserRole =
  | "ADMIN"
  | "BRANCHMANAGER"
  | "TELLER"
  | "AGENT"
  | "MEMBER"
  | "ACCOUNTANT"
  | "LOANOFFICER"
  | "AUDITOR"
  | "INSTITUTION";

interface Branch {
  id: string;
  name: string;
}

interface Member {
  id: string;
  memberNumber: string;
  accounts?: any[];
  fixedDeposits?: any[];
}

interface UserFloat {
  id: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  nationalId: string | null;
  jobTitle: string | null;
  areaOfOperation: string | null;
  role: UserRole;
  branchId: string | null;
  isActive: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Branch | null;
  member?: Member | null;
  deposits?: any[];
  withdrawals?: any[];
  loanRepayments?: any[];
  userFloat?: UserFloat | null;
  floatTransactions?: any[];
}

interface Activity {
  action: string;
  details: string;
  timestamp: string;
}

interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  image?: string | null;
}

interface UserDetailClientProps {
  user: User;
  currentUser: CurrentUser;
  recentActivity: Activity[];
  floatTransactions: any[];
}

interface FormData {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  nationalId: string;
  jobTitle: string;
  areaOfOperation: string;
  role: UserRole;
  branchId: string;
  isActive: boolean;
}

export default function UserDetailClient({
  user,
  currentUser,
  recentActivity,
  floatTransactions,
}: UserDetailClientProps) {
  const router = useRouter();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: user.name || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    phone: user.phone || "",
    address: user.address || "",
    nationalId: user.nationalId || "",
    jobTitle: user.jobTitle || "",
    areaOfOperation: user.areaOfOperation || "",
    role: user.role || "MEMBER",
    branchId: user.branchId || "",
    isActive: user.isActive,
  });

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };

      // Auto-update name when firstName or lastName changes
      if (field === "firstName" || field === "lastName") {
        const firstName =
          field === "firstName" ? (value as string) : prev.firstName;
        const lastName =
          field === "lastName" ? (value as string) : prev.lastName;
        updated.name = `${firstName} ${lastName}`.trim();
      }

      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Failed to update user"
        );
      }

      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      toast.error("Failed to update user", {
        description: errorMessage,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit =
    currentUser.role === "ADMIN" || currentUser.role === "BRANCHMANAGER";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-1">View and manage user information</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setIsEditDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="relative">
            <img
              src={user.image || "/avatar.avif"}
              alt={user.name || "User"}
              className="h-32 w-32 rounded-full object-cover border-4 border-gray-100"
            />
            <Badge
              variant={user.isActive ? "default" : "destructive"}
              className="absolute bottom-0 right-0"
            >
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="capitalize">
                {user.role.toLowerCase().replace(/_/g, " ")}
              </Badge>
              {user.member && (
                <Badge variant="outline">
                  Member #{user.member.memberNumber}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-semibold">{user.phone || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Branch</p>
                <p className="font-semibold">{user.branch?.name || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Job Title</p>
                <p className="font-semibold">{user.jobTitle || "N/A"}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="font-semibold">
                  {format(new Date(user.createdAt), "MMM dd, yyyy")}
                </p>
              </div>
            </div>

            {/* Additional Info */}
            {(user.nationalId || user.address) && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                {user.nationalId && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">National ID</p>
                    <p className="font-semibold">{user.nationalId}</p>
                  </div>
                )}
                {user.address && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Address</p>
                    <p className="font-semibold">{user.address}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Total Deposits</p>
          <p className="text-2xl font-bold text-green-600">
            {user.deposits?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Total Withdrawals</p>
          <p className="text-2xl font-bold text-orange-600">
            {user.withdrawals?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Loan Repayments</p>
          <p className="text-2xl font-bold text-blue-600">
            {user.loanRepayments?.length || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Float Balance</p>
          <p className="text-2xl font-bold text-purple-600">
            UGX {user.userFloat?.balance?.toLocaleString() || "0"}
          </p>
        </div>
      </div>

      {/* Member Accounts & Fixed Deposits */}
      {user.member && ((user.member.accounts && user.member.accounts.length > 0) || (user.member.fixedDeposits && user.member.fixedDeposits.length > 0)) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Member Accounts</h3>
            <Badge variant="secondary">
              {(user.member.accounts?.length || 0) + (user.member.fixedDeposits?.length || 0)} Account{((user.member.accounts?.length || 0) + (user.member.fixedDeposits?.length || 0)) !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Regular Accounts */}
            {user.member.accounts?.map((account: any) => (
              <div 
                key={account.id} 
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {account.accountType?.name || 'Unknown Account'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {account.accountNumber}
                    </p>
                  </div>
                  <Badge variant={account.isActive ? "default" : "destructive"}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                    <span className="text-sm text-gray-600">Balance:</span>
                    <span className="font-bold text-lg text-blue-600">
                      UGX {account.balance?.toLocaleString() || '0'}
                    </span>
                  </div>
                  {account.minimumBalance && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Min Balance:</span>
                      <span className="font-medium">
                        UGX {account.minimumBalance.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {account.createdAt && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Opened:</span>
                      <span className="font-medium">
                        {format(new Date(account.createdAt), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Fixed Deposit Accounts */}
            {user.member.fixedDeposits?.map((fd: any) => (
              <div 
                key={fd.id} 
                className="border border-green-200 bg-green-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/dashboard/accounts/fixed-deposits`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Fixed Deposit Account
                    </p>
                    <p className="text-sm text-gray-600">
                      {fd.accountNumber}
                    </p>
                  </div>
                  <Badge variant={fd.status === 'ACTIVE' ? "default" : fd.status === 'MATURED' ? "secondary" : "destructive"}>
                    {fd.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-t border-green-200 pt-2">
                    <span className="text-sm text-gray-600">Principal:</span>
                    <span className="font-bold text-lg text-green-600">
                      UGX {fd.principalAmount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Maturity Amount:</span>
                    <span className="font-medium text-green-700">
                      UGX {fd.maturityAmount?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Interest Rate:</span>
                    <span className="font-medium">
                      {fd.interestRate}% ({fd.termMonths} months)
                    </span>
                  </div>
                  {fd.maturityDate && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Matures:</span>
                      <span className="font-medium">
                        {format(new Date(fd.maturityDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium capitalize">{activity.action}</p>
                  <p className="text-sm text-gray-600">{activity.details}</p>
                </div>
                <p className="text-sm text-gray-500">
                  {format(new Date(activity.timestamp), "MMM dd, hh:mm a")}
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>

      {/* Float Transactions */}
      {user.userFloat && floatTransactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Recent Float Transactions
          </h3>
          <div className="space-y-3">
            {floatTransactions.slice(0, 5).map((transaction: any) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium capitalize">
                    {transaction.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-gray-600">
                    {transaction.description || "Float transaction"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      transaction.type.includes("ALLOCATION") ||
                      transaction.type.includes("DEPOSIT")
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {transaction.type.includes("ALLOCATION") ||
                    transaction.type.includes("DEPOSIT")
                      ? "+"
                      : "-"}
                    UGX {transaction.amount?.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(
                      new Date(
                        transaction.transactionDate || transaction.createdAt
                      ),
                      "MMM dd, hh:mm a"
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Profile</DialogTitle>
            <DialogDescription>
              Update user information and settings
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    handleInputChange("firstName", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    handleInputChange("lastName", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationalId">National ID</Label>
                <Input
                  id="nationalId"
                  value={formData.nationalId}
                  onChange={(e) =>
                    handleInputChange("nationalId", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  value={formData.jobTitle}
                  onChange={(e) =>
                    handleInputChange("jobTitle", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="areaOfOperation">Area of Operation</Label>
                <Input
                  id="areaOfOperation"
                  value={formData.areaOfOperation}
                  onChange={(e) =>
                    handleInputChange("areaOfOperation", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    handleInputChange("role", value as UserRole)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="BRANCHMANAGER">
                      Branch Manager
                    </SelectItem>
                    <SelectItem value="TELLER">Teller</SelectItem>
                    <SelectItem value="AGENT">Agent</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    <SelectItem value="LOANOFFICER">Loan Officer</SelectItem>
                    <SelectItem value="AUDITOR">Auditor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive">Status</Label>
                <Select
                  value={formData.isActive.toString()}
                  onValueChange={(value) =>
                    handleInputChange("isActive", value === "true")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
