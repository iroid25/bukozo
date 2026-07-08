"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Plus, TrendingUp, Info } from "lucide-react";
import FixedDepositTransferForm from "./components/FixedDepositTransferForm";
import FixedDepositListing from "./components/FixedDepositListing";

export default function FixedDepositsPage() {
  const [stats, setStats] = useState({ totalCount: 0, totalPrincipal: 0, expectedInterest: 0 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listingRefreshKey, setListingRefreshKey] = useState(0);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/accounts/fixed-deposits/stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", minimumFractionDigits: 0 }).format(val);

  const handleFormClose = () => {
    setIsFormOpen(false);
    fetchStats();
    setListingRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-8 p-6 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-slate-900">
            <Lock className="h-8 w-8 text-blue-600" />
            Fixed Deposit Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Secure long-term savings for Members and Institutions
          </p>
        </div>
        <Button 
          onClick={() => setIsFormOpen(true)} 
          size="lg" 
          className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Fixed Deposit
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Active Accounts</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Lock className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{stats.totalCount}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Total active fixed terms</p>
          </CardContent>
        </Card>

        <Card className="border-green-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Total Principal</CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
             {loading ? (
              <div className="h-8 w-32 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{formatCurrency(stats.totalPrincipal)}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Invested capital in branch</p>
          </CardContent>
        </Card>

        <Card className="border-purple-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">Projected Interest</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-50 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
             {loading ? (
              <div className="h-8 w-32 bg-slate-100 animate-pulse rounded" />
            ) : (
              <div className="text-3xl font-bold text-slate-900">{formatCurrency(stats.expectedInterest)}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">Total payout at maturity</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Listing Section */}
      <FixedDepositListing refreshKey={listingRefreshKey} />

      {/* Info Card */}
      <Card className="border-slate-200 bg-slate-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-slate-600" />
            Important Guidelines
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 text-sm text-slate-600">
           <div className="space-y-3">
             <h4 className="font-semibold text-slate-900">Entity Eligibility:</h4>
             <ul className="space-y-2 list-disc list-inside">
               <li>Both individual Members and Institutions can open accounts</li>
               <li>Institutions must have a valid Voluntary Savings account</li>
               <li>Signatory authorization is required for institutional transfers</li>
             </ul>
           </div>
           <div className="space-y-3">
             <h4 className="font-semibold text-slate-900">Withdrawal Policy:</h4>
             <ul className="space-y-2 list-disc list-inside">
               <li>Fixed term must be completed before maturity interest is paid</li>
               <li>Early withdrawal may incur penalties or loss of interest</li>
               <li>Automated maturity transfer returns funds to source account</li>
             </ul>
           </div>
        </CardContent>
      </Card>

      {/* Transfer Form Dialog */}
      <FixedDepositTransferForm 
        isOpen={isFormOpen} 
        onClose={handleFormClose} 
      />
    </div>
  );
}

