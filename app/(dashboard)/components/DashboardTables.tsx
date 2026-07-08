// "use client";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import {
//   Users,
//   UserCheck,
//   TrendingUp,
//   Eye,
//   MoreHorizontal,
//   ArrowUpRight,
//   Calendar,
//   CreditCard,
//   DollarSign,
//   Smartphone,
// } from "lucide-react";
// import { formatISODate } from "@/lib/utils";
// import { useRouter } from "next/navigation";

// interface User {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
//   createdAt: Date;
//   isActive: boolean;
//   image: string | null;
// }

// interface Member {
//   id: string;
//   memberNumber: string;
//   createdAt: Date;
//   user: {
//     name: string;
//     email: string;
//     phone: string | null;
//     image: string | null;
//   };
//   accounts: Array<{
//     balance: number;
//   }>;
// }

// interface Transaction {
//   id: string;
//   transactionRef: string;
//   type: string;
//   amount: number;
//   transactionDate: Date;
//   status: string;
//   channel: string | null;
//   member: {
//     user: {
//       name: string;
//       image: string | null;
//     };
//   };
//   account: {
//     accountNumber: string;
//   };
// }

// interface Deposit {
//   id: string;
//   amount: number;
//   depositDate: Date;
//   channel: string;
//   member: {
//     user: {
//       name: string;
//       image: string | null;
//     };
//   };
//   account: {
//     accountNumber: string;
//   };
//   transaction: {
//     transactionRef: string;
//   };
// }

// interface DashboardTablesProps {
//   recentUsers?: User[];
//   recentMembers?: Member[];
//   recentTransactions?: Transaction[];
//   recentDeposits?: Deposit[];
//   userRole: string;
// }

// function formatCurrency(amount: number) {
//   return new Intl.NumberFormat("en-UG", {
//     style: "currency",
//     currency: "UGX",
//     minimumFractionDigits: 0,
//   }).format(amount);
// }

// function getRoleColor(role: string) {
//   const colors = {
//     ADMIN: "bg-red-100 text-red-800",
//     BRANCHMANAGER: "bg-blue-100 text-blue-800",
//     TELLER: "bg-green-100 text-green-800",
//     AGENT: "bg-purple-100 text-purple-800",
//     MEMBER: "bg-gray-100 text-gray-800",
//   };
//   return colors[role as keyof typeof colors] || colors.MEMBER;
// }

// function getTransactionIcon(type: string) {
//   switch (type) {
//     case "DEPOSIT":
//       return <TrendingUp className="h-4 w-4 text-green-600" />;
//     case "WITHDRAWAL":
//       return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
//     case "LOAN_DISBURSEMENT":
//       return <DollarSign className="h-4 w-4 text-blue-600" />;
//     case "LOAN_REPAYMENT":
//       return <CreditCard className="h-4 w-4 text-purple-600" />;
//     default:
//       return <MoreHorizontal className="h-4 w-4 text-gray-600" />;
//   }
// }

// function getTransactionColor(type: string) {
//   switch (type) {
//     case "DEPOSIT":
//       return "text-green-600";
//     case "WITHDRAWAL":
//       return "text-red-600";
//     case "LOAN_DISBURSEMENT":
//       return "text-blue-600";
//     case "LOAN_REPAYMENT":
//       return "text-purple-600";
//     default:
//       return "text-gray-600";
//   }
// }

// function RecentUsersTable({ users }: { users: User[] }) {
//   const router = useRouter();

//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between">
//         <CardTitle className="flex items-center gap-2">
//           <Users className="h-5 w-5 text-blue-600" />
//           Recent Users
//         </CardTitle>
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => router.push("/dashboard/users")}
//         >
//           View All
//           <ArrowUpRight className="h-4 w-4 ml-1" />
//         </Button>
//       </CardHeader>
//       <CardContent>
//         <div className="space-y-4">
//           {users.map((user) => (
//             <div
//               key={user.id}
//               className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
//             >
//               <div className="flex items-center gap-3">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
//                   {user.image ? (
//                     <img
//                       src={user.image}
//                       alt={user.name}
//                       className="h-10 w-10 rounded-full object-cover"
//                     />
//                   ) : (
//                     <Users className="h-5 w-5 text-gray-600" />
//                   )}
//                 </div>
//                 <div>
//                   <p className="font-medium text-gray-900">{user.name}</p>
//                   <p className="text-sm text-gray-500">{user.email}</p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-2">
//                 <Badge className={getRoleColor(user.role)} variant="secondary">
//                   {user.role}
//                 </Badge>
//                 <div className="text-right">
//                   <p className="text-sm text-gray-500">
//                     {formatISODate(user.createdAt)}
//                   </p>
//                   <div className="flex items-center gap-1">
//                     <div
//                       className={`w-2 h-2 rounded-full ${user.isActive ? "bg-green-400" : "bg-red-400"}`}
//                     ></div>
//                     <span className="text-xs text-gray-400">
//                       {user.isActive ? "Active" : "Inactive"}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           ))}
//           {users.length === 0 && (
//             <div className="text-center py-8 text-gray-500">
//               <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No users found</p>
//             </div>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// function RecentMembersTable({ members }: { members: Member[] }) {
//   const router = useRouter();

//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between">
//         <CardTitle className="flex items-center gap-2">
//           <UserCheck className="h-5 w-5 text-green-600" />
//           Recent Members
//         </CardTitle>
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => router.push("/dashboard/members")}
//         >
//           View All
//           <ArrowUpRight className="h-4 w-4 ml-1" />
//         </Button>
//       </CardHeader>
//       <CardContent>
//         <div className="space-y-4">
//           {members.map((member) => {
//             const totalBalance = member.accounts.reduce(
//               (sum, account) => sum + account.balance,
//               0
//             );

//             return (
//               <div
//                 key={member.id}
//                 className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
//               >
//                 <div className="flex items-center gap-3">
//                   <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
//                     {member.user.image ? (
//                       <img
//                         src={member.user.image}
//                         alt={member.user.name}
//                         className="h-10 w-10 rounded-full object-cover"
//                       />
//                     ) : (
//                       <UserCheck className="h-5 w-5 text-gray-600" />
//                     )}
//                   </div>
//                   <div>
//                     <p className="font-medium text-gray-900">
//                       {member.user.name}
//                     </p>
//                     <p className="text-sm text-gray-500">
//                       #{member.memberNumber}
//                     </p>
//                   </div>
//                 </div>
//                 <div className="text-right">
//                   <p className="font-medium text-green-600">
//                     {formatCurrency(totalBalance)}
//                   </p>
//                   <p className="text-sm text-gray-500">
//                     {formatISODate(member.createdAt)}
//                   </p>
//                 </div>
//               </div>
//             );
//           })}
//           {members.length === 0 && (
//             <div className="text-center py-8 text-gray-500">
//               <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No members found</p>
//             </div>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// function RecentTransactionsTable({
//   transactions,
// }: {
//   transactions: Transaction[];
// }) {
//   const router = useRouter();

//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between">
//         <CardTitle className="flex items-center gap-2">
//           <TrendingUp className="h-5 w-5 text-purple-600" />
//           Recent Transactions
//         </CardTitle>
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => router.push("/dashboard/transactions")}
//         >
//           View All
//           <ArrowUpRight className="h-4 w-4 ml-1" />
//         </Button>
//       </CardHeader>
//       <CardContent>
//         <div className="space-y-4">
//           {transactions.map((transaction) => (
//             <div
//               key={transaction.id}
//               className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
//             >
//               <div className="flex items-center gap-3">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
//                   {getTransactionIcon(transaction.type)}
//                 </div>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <p className="font-medium text-gray-900">
//                       {transaction.transactionRef}
//                     </p>
//                     {transaction.channel === "Mobile Money" && (
//                       <Smartphone className="h-3 w-3 text-blue-500" />
//                     )}
//                   </div>
//                   <p className="text-sm text-gray-500">
//                     {transaction.member.user.name} •{" "}
//                     {transaction.account.accountNumber}
//                   </p>
//                 </div>
//               </div>
//               <div className="text-right">
//                 <p
//                   className={`font-medium ${getTransactionColor(transaction.type)}`}
//                 >
//                   {transaction.type === "WITHDRAWAL" ? "-" : "+"}
//                   {formatCurrency(transaction.amount)}
//                 </p>
//                 <p className="text-sm text-gray-500">
//                   {formatISODate(transaction.transactionDate)}
//                 </p>
//               </div>
//             </div>
//           ))}
//           {transactions.length === 0 && (
//             <div className="text-center py-8 text-gray-500">
//               <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No transactions found</p>
//             </div>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// function RecentDepositsTable({ deposits }: { deposits: Deposit[] }) {
//   const router = useRouter();

//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between">
//         <CardTitle className="flex items-center gap-2">
//           <TrendingUp className="h-5 w-5 text-green-600" />
//           Recent Deposits
//         </CardTitle>
//         <Button
//           variant="outline"
//           size="sm"
//           onClick={() => router.push("/dashboard/deposits")}
//         >
//           View All
//           <ArrowUpRight className="h-4 w-4 ml-1" />
//         </Button>
//       </CardHeader>
//       <CardContent>
//         <div className="space-y-4">
//           {deposits.map((deposit) => (
//             <div
//               key={deposit.id}
//               className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
//             >
//               <div className="flex items-center gap-3">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
//                   {deposit.channel === "Mobile Money" ? (
//                     <Smartphone className="h-5 w-5 text-green-600" />
//                   ) : (
//                     <TrendingUp className="h-5 w-5 text-green-600" />
//                   )}
//                 </div>
//                 <div>
//                   <div className="flex items-center gap-2">
//                     <p className="font-medium text-gray-900">
//                       {deposit.transaction.transactionRef}
//                     </p>
//                     <Badge
//                       variant="secondary"
//                       className={
//                         deposit.channel === "Mobile Money"
//                           ? "bg-blue-100 text-blue-800"
//                           : "bg-gray-100 text-gray-800"
//                       }
//                     >
//                       {deposit.channel}
//                     </Badge>
//                   </div>
//                   <p className="text-sm text-gray-500">
//                     {deposit.member.user.name} • {deposit.account.accountNumber}
//                   </p>
//                 </div>
//               </div>
//               <div className="text-right">
//                 <p className="font-medium text-green-600">
//                   +{formatCurrency(deposit.amount)}
//                 </p>
//                 <p className="text-sm text-gray-500">
//                   {formatISODate(deposit.depositDate)}
//                 </p>
//               </div>
//             </div>
//           ))}
//           {deposits.length === 0 && (
//             <div className="text-center py-8 text-gray-500">
//               <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
//               <p>No deposits found</p>
//             </div>
//           )}
//         </div>
//       </CardContent>
//     </Card>
//   );
// }

// // Role-based table configurations
// function getRoleTables(
//   userRole: string,
//   recentUsers: User[] = [],
//   recentMembers: Member[] = [],
//   recentTransactions: Transaction[] = [],
//   recentDeposits: Deposit[] = []
// ) {
//   switch (userRole) {
//     case "ADMIN":
//       return [
//         <RecentUsersTable key="users" users={recentUsers} />,
//         <RecentMembersTable key="members" members={recentMembers} />,
//       ];
//     case "BRANCHMANAGER":
//       return [
//         <RecentMembersTable key="members" members={recentMembers} />,
//         <RecentTransactionsTable
//           key="transactions"
//           transactions={recentTransactions}
//         />,
//       ];
//     case "TELLER":
//       return [
//         <RecentDepositsTable key="deposits" deposits={recentDeposits} />,
//         <RecentTransactionsTable
//           key="transactions"
//           transactions={recentTransactions}
//         />,
//       ];
//     case "AGENT":
//       return [
//         <RecentDepositsTable
//           key="deposits"
//           deposits={recentDeposits.filter((d) => d.channel === "Mobile Money")}
//         />,
//         <RecentMembersTable key="members" members={recentMembers} />,
//       ];
//     default: // MEMBER
//       return [
//         <RecentTransactionsTable
//           key="transactions"
//           transactions={recentTransactions}
//         />,
//         <RecentDepositsTable key="deposits" deposits={recentDeposits} />,
//       ];
//   }
// }

// export default function DashboardTables({
//   recentUsers = [],
//   recentMembers = [],
//   recentTransactions = [],
//   recentDeposits = [],
//   userRole,
// }: DashboardTablesProps) {
//   const tables = getRoleTables(
//     userRole,
//     recentUsers,
//     recentMembers,
//     recentTransactions,
//     recentDeposits
//   );

//   return <div className="grid gap-6 lg:grid-cols-2">{tables}</div>;
// }

"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  UserCheck,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  Phone,
  Mail,
} from "lucide-react";

interface DashboardTablesProps {
  userRole: string;
  recentUsers?: any[];
  recentMembers?: any[];
  recentTransactions?: any[];
  recentDeposits?: any[];
}

function formatCurrency(amount: number | undefined | null) {
  if (!amount && amount !== 0) return "UGX 0";
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
}

function safeFormatDate(dateString: any) {
  if (!dateString) return "Recently";
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (error) {
    return "Recently";
  }
}

function RecentUsersTable({ users }: { users: any[] }) {
  // Triple safety check
  if (!users || !Array.isArray(users) || users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent users found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users
        .map((user, index) => {
          // Null safety for each user
          if (!user) return null;

          return (
            <div
              key={user?.id || `user-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user?.avatar || ""} />
                  <AvatarFallback>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{user?.name || "Unknown User"}</p>
                  <p className="text-sm text-gray-500">
                    {user?.email || "No email"}
                  </p>
                </div>
              </div>
              <div className="text-right w-full sm:w-auto">
                <Badge
                  variant={user?.isActive ? "default" : "secondary"}
                  className="mb-1"
                >
                  {user?.role || "USER"}
                </Badge>
                <p className="text-xs text-gray-500">
                  {safeFormatDate(user?.createdAt)}
                </p>
              </div>
            </div>
          );
        })
        .filter(Boolean)}{" "}
      {/* Remove any null entries */}
    </div>
  );
}

function RecentMembersTable({ members }: { members: any[] }) {
  // Triple safety check
  if (!members || !Array.isArray(members) || members.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent members found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {members
        .map((member, index) => {
          // Null safety for each member
          if (!member) return null;

          // BULLETPROOF calculation of total balance - THIS FIXES THE ERROR
          let totalBalance = 0;
          try {
            if (member.accounts && Array.isArray(member.accounts)) {
              totalBalance = member.accounts.reduce(
                (sum: number, account: any) => {
                  const balance = account?.balance || 0;
                  return sum + (typeof balance === "number" ? balance : 0);
                },
                0
              );
            }
          } catch (error) {
            console.warn(
              "Error calculating balance for member:",
              member?.id,
              error
            );
            totalBalance = 0;
          }

          return (
            <div
              key={member?.id || `member-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={member?.user?.avatar || member?.avatar || ""}
                  />
                  <AvatarFallback>
                    {member?.user?.name?.charAt(0)?.toUpperCase() ||
                      member?.name?.charAt(0)?.toUpperCase() ||
                      "M"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {member?.user?.name || member?.name || "Unknown Member"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {member?.memberNumber || "No member number"}
                  </p>
                </div>
              </div>
              <div className="text-right w-full sm:w-auto">
                <div className="font-medium text-green-600 mb-1">
                  {formatCurrency(totalBalance)}
                </div>
                <Badge
                  variant={member?.isApproved ? "default" : "secondary"}
                  className="text-xs"
                >
                  {member?.isApproved ? "Approved" : "Pending"}
                </Badge>
              </div>
            </div>
          );
        })
        .filter(Boolean)}{" "}
      {/* Remove any null entries */}
    </div>
  );
}

function RecentTransactionsTable({ transactions }: { transactions: any[] }) {
  // Triple safety check
  if (
    !transactions ||
    !Array.isArray(transactions) ||
    transactions.length === 0
  ) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent transactions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions
        .map((transaction, index) => {
          // Null safety for each transaction
          if (!transaction) return null;

          return (
            <div
              key={transaction?.id || `transaction-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                <div
                  className={`p-2 rounded-full ${
                    transaction?.type === "DEPOSIT"
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}
                >
                  {transaction?.type === "DEPOSIT" ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {transaction?.description ||
                      transaction?.type ||
                      "Transaction"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {transaction?.account?.accountNumber ||
                      transaction?.accountNumber ||
                      "Unknown Account"}
                  </p>
                </div>
              </div>
              <div className="text-right w-full sm:w-auto">
                <div
                  className={`font-medium ${
                    transaction?.type === "DEPOSIT"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction?.type === "DEPOSIT" ? "+" : "-"}
                  {formatCurrency(transaction?.amount)}
                </div>
                <p className="text-xs text-gray-500">
                  {safeFormatDate(transaction?.createdAt)}
                </p>
              </div>
            </div>
          );
        })
        .filter(Boolean)}{" "}
      {/* Remove any null entries */}
    </div>
  );
}

function RecentDepositsTable({ deposits }: { deposits: any[] }) {
  // Triple safety check
  if (!deposits || !Array.isArray(deposits) || deposits.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No recent deposits found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deposits
        .map((deposit, index) => {
          // Null safety for each deposit
          if (!deposit) return null;

          return (
            <div
              key={deposit?.id || `deposit-${index}`}
              className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                <div className="p-2 bg-green-100 rounded-full">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">
                    {deposit?.method === "MOBILE_MONEY"
                      ? "Mobile Money"
                      : "Cash"}{" "}
                    Deposit
                  </p>
                  <p className="text-sm text-gray-500">
                    {deposit?.account?.institution?.institutionName ||
                      deposit?.institution?.institutionName ||
                      deposit?.account?.member?.user?.name ||
                      deposit?.memberName ||
                      deposit?.account?.member?.name ||
                      "Unknown"}
                  </p>
                </div>
              </div>
              <div className="text-right w-full sm:w-auto">
                <div className="font-medium text-green-600">
                  {formatCurrency(deposit?.amount)}
                </div>
                <p className="text-xs text-gray-500">
                  {safeFormatDate(deposit?.createdAt)}
                </p>
              </div>
            </div>
          );
        })
        .filter(Boolean)}{" "}
      {/* Remove any null entries */}
    </div>
  );
}

export default function DashboardTables({
  userRole,
  recentUsers,
  recentMembers,
  recentTransactions,
  recentDeposits,
}: DashboardTablesProps) {
  // Role-based table configuration with safety checks
  const getRoleTables = () => {
    switch (userRole) {
      case "ADMIN":
        return [
          {
            title: "Recent Users",
            icon: Users,
            component: <RecentUsersTable users={recentUsers || []} />,
          },
          {
            title: "Recent Members",
            icon: UserCheck,
            component: <RecentMembersTable members={recentMembers || []} />,
          },
        ];
      case "BRANCHMANAGER":
        return [
          {
            title: "Recent Members",
            icon: UserCheck,
            component: <RecentMembersTable members={recentMembers || []} />,
          },
          {
            title: "Recent Transactions",
            icon: CreditCard,
            component: (
              <RecentTransactionsTable
                transactions={recentTransactions || []}
              />
            ),
          },
        ];
      case "TELLER":
        return [
          {
            title: "Recent Deposits",
            icon: ArrowUpRight,
            component: <RecentDepositsTable deposits={recentDeposits || []} />,
          },
          {
            title: "Recent Transactions",
            icon: CreditCard,
            component: (
              <RecentTransactionsTable
                transactions={recentTransactions || []}
              />
            ),
          },
        ];
      case "AGENT":
        return [
          {
            title: "Recent Deposits",
            icon: ArrowUpRight,
            component: <RecentDepositsTable deposits={recentDeposits || []} />,
          },
          {
            title: "Recent Members",
            icon: UserCheck,
            component: <RecentMembersTable members={recentMembers || []} />,
          },
        ];
      default: // MEMBER
        return [
          {
            title: "Recent Transactions",
            icon: CreditCard,
            component: (
              <RecentTransactionsTable
                transactions={recentTransactions || []}
              />
            ),
          },
          {
            title: "Recent Deposits",
            icon: ArrowUpRight,
            component: <RecentDepositsTable deposits={recentDeposits || []} />,
          },
        ];
    }
  };

  const tables = getRoleTables();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {tables.map((table, index) => (
        <Card key={`table-${index}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <table.icon className="h-5 w-5" />
              {table.title}
            </CardTitle>
          </CardHeader>
          <CardContent>{table.component}</CardContent>
        </Card>
      ))}
    </div>
  );
}
