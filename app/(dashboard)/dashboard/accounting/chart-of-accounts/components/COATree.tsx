"use client";

import { useEffect, useState } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Eye, 
  Loader2,
  AlertCircle,
  Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAccountingSyncVersion } from "@/lib/hooks/useAccountingSync";

interface COANode {
  id: string;
  accountCode: string;
  accountName: string;
  fullCode: string;
  level: number;
  ledgerType: string;
  balance: number;
  debitBalance: number;
  creditBalance: number;
  isActive: boolean;
  children: COANode[];
}

interface COATreeProps {
  onViewDetails: (accountId: string) => void;
}

export function COATree({ onViewDetails }: COATreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const accountingSyncVersion = useAccountingSyncVersion({
    enabled: true,
  });

  const { 
    data, 
    isLoading: loading, 
    isError, 
    error, 
    isFetching,
    refetch: fetchTree
  } = useQuery({
    queryKey: ["chart-of-accounts-tree", accountingSyncVersion],
    queryFn: async () => {
      const response = await fetch("/api/v1/chart-of-accounts/tree");
      if (!response.ok) throw new Error("Failed to fetch tree");
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to fetch tree");
      return result.data as COANode[];
    },
    refetchInterval: 15000, // 15s Real-time Sync
  });

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    if (!data || data.length === 0) return;

    setExpanded((prev) => {
      const next = { ...prev };
      const seedRoot = (node: COANode) => {
        if (node.children.length > 0 && next[node.id] === undefined) {
          next[node.id] = true;
        }
        node.children.forEach(seedRoot);
      };

      data.forEach(seedRoot);
      return next;
    });
  }, [data]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderNode = (node: COANode, depth: number = 0) => {
    const isExpanded = expanded[node.id];
    const hasChildren = node.children && node.children.length > 0;
    
    // Strict Label Mapping
    const ledgerLabels: Record<string, string> = {
        ASSETS: "Assets",
        LIABILITIES: "Liabilities",
        EQUITY: "Equity",
        INCOME: "Income",
        EXPENDITURES: "Expenditures"
    };

    return (
      <div key={node.id} className="select-none">
        <div 
          className={cn(
            "group flex items-center py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl transition-all cursor-pointer",
            depth === 0 ? 'mt-4 border-b pb-4 mb-2' : ''
          )}
          style={{ paddingLeft: `${depth * 24 + 12}px` }}
          onClick={() => hasChildren ? toggleExpand(node.id) : null}
        >
          <div className="flex items-center gap-3 flex-1">
            {hasChildren ? (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            
            {hasChildren ? (
              <Folder className={cn(
                  "h-4 w-4 transition-colors",
                  isExpanded ? 'text-blue-500 fill-blue-500/10' : 'text-slate-400'
              )} />
            ) : (
              <FileText className="h-4 w-4 text-emerald-500" />
            )}
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                  {node.accountCode}
                </span>
                <span className={cn(
                    "text-sm font-semibold transition-colors",
                    depth === 0 ? 'text-base font-black tracking-tight' : 'text-slate-700 dark:text-slate-300'
                )}>
                  {node.accountName}
                </span>
              </div>
              {depth === 0 && (
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">
                  {ledgerLabels[node.ledgerType] || node.ledgerType}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end min-w-[140px]">
              <span className={cn(
                  "text-sm font-black font-mono",
                  node.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {formatCurrency(node.balance)}
              </span>
              <div className="flex gap-4 text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                <span>DR: {formatCurrency(node.debitBalance)}</span>
                <span>CR: {formatCurrency(node.creditBalance)}</span>
              </div>
            </div>
            
            <Button 
              variant="secondary" 
              size="icon" 
              className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all border shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(node.id);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="animate-in slide-in-from-top-1 duration-300">
        {node.children.map((child: COANode) => renderNode(child, depth + 1))}
        </div>
      )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
            <Loader2 className="h-14 w-14 animate-spin text-primary relative z-10" />
        </div>
        <div className="text-center space-y-1">
            <p className="text-slate-900 dark:text-white font-black text-xl tracking-tight">Syncing Financial Hierarchy</p>
            <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Establishing real-time connection to COA...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-rose-200 bg-rose-50/30 dark:bg-rose-900/10 rounded-3xl overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="p-4 bg-rose-100 dark:bg-rose-900/30 rounded-3xl text-rose-600">
              <AlertCircle size={40} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">Connection Interrupted</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">We couldn't establish a live link to the Chart of Accounts tree. Please check your permissions or network status.</p>
          </div>
          <Button onClick={() => fetchTree()} variant="outline" className="rounded-2xl px-8 h-12 font-bold border-rose-200">Retry Live Sync</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border">
                <Network className="h-4 w-4 text-primary" />
            </div>
            <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:text-white">Financial Architecture</h2>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Real-time Hierarchy</span>
                </div>
            </div>
        </div>
        <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-slate-300" /> Header Group
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-500" /> Posting Account
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/20 dark:shadow-none p-8 min-h-[500px]">
        {!data || data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
                <History size={48} strokeWidth={1} />
                <p className="font-bold uppercase tracking-widest text-xs">No account structure defined</p>
            </div>
        ) : (
            data.map((node: COANode) => renderNode(node))
        )}
      </div>
    </div>
  );
}

import { Network, History } from "lucide-react";
