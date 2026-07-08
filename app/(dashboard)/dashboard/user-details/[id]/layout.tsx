"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberNavigation } from "./member-navigation";
import {
  Mail,
  Phone,
  CreditCard,
  Plus,
  Minus,
  Eye,
  Wallet,
  Clock,
  BadgeIcon as IdCard,
  Check,
} from "lucide-react";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/members/${id}`)
      .then((r) => r.json())
      .then((json) => {
        setMember(json.data || null);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!member) return notFound();

  const role = member.user?.role;
  const account = member.accounts?.[0];
  const amount = account?.balance;

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-6 space-y-6">
        {/* Member Header */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left Section - Profile Info */}
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-white shadow-sm">
                    <AvatarImage src={member.user?.image || ""} alt={member.user?.name} className="object-cover" />
                    <AvatarFallback className="text-xl font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <Button size="sm" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 bg-white shadow-sm">
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{member.user?.name}</h1>
                    <p className="text-gray-600 font-medium">Member #{member.memberNumber}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" /><span>{member.user?.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" /><span>{member.user?.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CreditCard className="h-4 w-4" /><span>{member.user?.nationalId}</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Right Section - Actions & Info */}
              <div className="flex flex-col items-end gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-semibold text-gray-900">
                    {member.registrationDate ? new Date(member.registrationDate).toLocaleDateString() : "N/A"}
                  </p>
                  {member.savingsAccountNumber && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">Savings Account</p>
                      <p className="font-semibold text-gray-900">{member.savingsAccountNumber}</p>
                    </div>
                  )}
                </div>
                <Button className="bg-green-600 hover:bg-green-700 shadow-sm">
                  <Check className="h-4 w-4 mr-2" />{role?.toUpperCase()}
                </Button>
                {!(role === "TELLER" || role === "AGENT" || role === "BRANCHMANAGER") && (
                  <div className="flex gap-3">
                    <Button className="bg-green-600 hover:bg-green-700 shadow-sm">
                      <Plus className="h-4 w-4 mr-2" />Deposit
                    </Button>
                    <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 shadow-sm">
                      <Minus className="h-4 w-4 mr-2" />Withdraw
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-5 w-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-600">Account Balance</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">UGX {amount ? Number(amount).toLocaleString() : "0"}</p>
                  <p className="text-xs text-gray-500 mt-1">Available Balance</p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <p className="text-sm font-medium text-gray-600">Pending Loans</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">UGX 0</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting Approval</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <IdCard className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-medium text-gray-600">National ID</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{member.user?.nationalId}</p>
                  <p className="text-xs text-gray-500 mt-1">Click to view document</p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <IdCard className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <MemberNavigation memberId={id} />

        {/* Content */}
        {children}
      </div>
    </div>
  );
}
