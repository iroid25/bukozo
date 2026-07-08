"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  ArrowLeft,
  Edit,
  MapPin,
  Phone,
  Mail,
  User,
  Users,
  CreditCard,
  Banknote,
  TrendingUp,
  Calendar,
  Building,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Branch } from "@/types/branches";
import { formatISODate, formatCurrency } from "@/lib/utils";
import BranchCreateForm from "./BranchCreateForm";

interface BranchDetailsViewProps {
  branch: Branch;
  userRole: string;
  statistics?: any;
  users?: any[];
}

export default function BranchDetailsView({
  branch,
  userRole,
  statistics,
  users = [],
}: BranchDetailsViewProps) {
  const router = useRouter();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const canEdit = userRole === "ADMIN";

  // Financial Stats
  const financialStats = [
    {
      title: "Total Deposits",
      value: statistics?.totalAccountsBalance || 0,
      icon: Wallet,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      isCurrency: true,
    },
    {
      title: "Loans Outstanding",
      value: statistics?.totalLoansOutstanding || 0,
      icon: TrendingUp,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
      isCurrency: true,
    },
    {
      title: "Active Accounts",
      value: statistics?.totalAccounts || branch._count?.accounts || 0,
      icon: CreditCard,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      isCurrency: false,
    },
    {
      title: "Active Loans",
      value: statistics?.activeLoans || branch._count?.loans || 0,
      icon: Banknote,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      isCurrency: false,
    },
  ];

  const handleEdit = () => {
    setEditModalOpen(true);
  };

  const handleBack = () => {
    router.push("/dashboard/branches");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Edit Modal */}
      <BranchCreateForm
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editingId={branch.id}
        initialData={{
          name: branch.name,
          location: branch.location,
          contactPerson: branch.contactPerson || "",
          contactPhone: branch.contactPhone || "",
          email: branch.email || "",
        }}
      />

      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -m-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -m-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-slate-400 hover:text-white hover:bg-white/10 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Network
            </Button>
            
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
                <Building className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">{branch.name}</h1>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Active
                  </Badge>
                </div>
                <p className="mt-1 text-slate-400 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  {branch.location}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit && (
              <Button 
                onClick={handleEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg shadow-blue-500/20"
              >
                <Edit className="h-4 w-4 mr-2" />
                Configure Branch
              </Button>
            )}
            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Financial Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {financialStats.map((stat, index) => (
          <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-2xl ${stat.bgColor} ${stat.color} group-hover:scale-110 transition-transform`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 tracking-tight">
                    {stat.isCurrency 
                      ? formatCurrency(stat.value)
                      : stat.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Staff & Operations */}
        <div className="lg:col-span-2 space-y-8">
          {/* Staff Members Section */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Staff Directory</CardTitle>
                <CardDescription>Members currently assigned to this branch</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white">{users.length} Personnel</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="pl-6">Personnel</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length > 0 ? (
                    users.slice(0, 5).map((user) => (
                      <TableRow key={user.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border-2 border-slate-100">
                              <AvatarImage src={user.image} alt={user.name} />
                              <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-slate-900 text-sm">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-medium">
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 text-slate-500 text-sm">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                        No staff members assigned yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {users.length > 5 && (
                <div className="p-4 bg-slate-50/20 border-t border-slate-100 text-center">
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => router.push(`/dashboard/users?branchId=${branch.id}`)}>
                    View all {users.length} branch members
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Productivity Trends placeholder */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Branch Performance</CardTitle>
                  <CardDescription>Activity overview for the last 30 days</CardDescription>
                </div>
                <SelectPeriod />
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-center space-y-2">
                  <TrendingUp className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-slate-400 text-sm font-medium">Coming Soon: Visual Analytics & Trends</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Information & Timeline */}
        <div className="space-y-8">
          {/* Branch Identity Card */}
          <Card className="border-none shadow-sm overflow-hidden group">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                Connectivity & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <InfoItem icon={User} label="Primary Contact" value={branch.contactPerson || "Standard Support"} />
                <InfoItem icon={Phone} label="Direct Line" value={branch.contactPhone || "Not configured"} />
                <InfoItem icon={Mail} label="Official Email" value={branch.email || "No branch email"} isEmail />
                <InfoItem icon={MapPin} label="Service Location" value={branch.location} />
              </div>
              
              <Separator className="bg-slate-100" />
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Infrastructure Timeline</h4>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm shadow-blue-100">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Established Network on</p>
                    <p className="text-sm font-bold text-slate-900">{formatISODate(branch.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-orange-50 text-orange-600 shadow-sm shadow-orange-100">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Last Security Review</p>
                    <p className="text-sm font-bold text-slate-900">{formatISODate(branch.updatedAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="border-none shadow-sm bg-blue-600 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -m-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-lg">Branch Center</CardTitle>
              <CardDescription className="text-blue-100">Quick access to branch operations</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 grid gap-3">
              <ShortcutButton 
                onClick={() => router.push(`/dashboard/users?branchId=${branch.id}`)}
                icon={Users}
                label="Manage Staff"
              />
              <ShortcutButton 
                onClick={() => router.push(`/dashboard/accounts?branchId=${branch.id}`)}
                icon={CreditCard}
                label="Accounts Portal"
              />
              <ShortcutButton 
                onClick={() => router.push(`/dashboard/loans?branchId=${branch.id}`)}
                icon={Banknote}
                label="Loan Operations"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Sub-components for cleaner code
function InfoItem({ icon: Icon, label, value, isEmail }: { icon: any, label: string, value: string, isEmail?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
        <p className={`text-sm font-semibold text-slate-800 ${isEmail ? 'truncate max-w-[180px]' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ShortcutButton({ onClick, icon: Icon, label }: { onClick: () => void, icon: any, label: string }) {
  return (
    <Button 
      variant="ghost" 
      onClick={onClick}
      className="w-full justify-between bg-white/10 hover:bg-white/20 text-white border-white/5 h-12 px-5 rounded-2xl"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 opacity-50" />
    </Button>
  );
}

function SelectPeriod() {
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-[10px] font-bold uppercase tracking-tight">
      <div className="px-2 py-1 bg-white rounded shadow-sm text-blue-600">30 Days</div>
      <div className="px-2 py-1 text-slate-500">6 Months</div>
      <div className="px-2 py-1 text-slate-500">Year</div>
    </div>
  );
}
