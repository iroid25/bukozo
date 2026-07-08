"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  code?: string;
  kind: string;
}

interface NewAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: Array<{
    id: string;
    accountCode: string;
    accountName: string;
    level: number;
    ledgerType?: string;
  }>;
}

export function NewAccountForm({ open, onOpenChange, onSuccess, accounts }: NewAccountFormProps) {
  const [loading, setLoading] = useState(false);
  
  // Categories for selection
  const [expenditureCategories, setExpenditureCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const [formData, setFormData] = useState({
    accountCode: "",
    accountName: "",
    ledgerType: "",
    level: "3",
    parentId: "",
    category: "",
    product: "",
    currency: "UGX",
    debitCredit: "",
    description: "",
  });

  // Fetch categories logic
  useEffect(() => {
    const fetchCategories = async () => {
        setIsLoadingCategories(true);
        try {
            // Fetch sequentially to avoid potential session race conditions on some environments
            const expRes = await fetch("/api/v1/expenditure/categories", { 
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: 'include'
            });
            
            if (expRes.ok) {
                const data = await expRes.json();
                setExpenditureCategories(data.data || []);
            } else {
                console.error("Failed to fetch expenditure categories:", expRes.status, expRes.statusText);
                if (expRes.status === 401) {
                    toast.error("Session expired. Please refresh the page.");
                    return; // Stop if 401
                }
            }

            const incRes = await fetch("/api/v1/income/categories", {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: 'include'
            });

            if (incRes.ok) {
                const data = await incRes.json();
                setIncomeCategories(data.data || []);
            } else {
                console.error("Failed to fetch income categories:", incRes.status, incRes.statusText);
            }
        } catch (error) {
            console.error("Failed to fetch categories", error);
            toast.error("Network error fetching categories");
        } finally {
            setIsLoadingCategories(false);
        }
    };
    
    if (open) {
        fetchCategories();
    }
  }, [open]);


  const handleLedgerTypeChange = (value: string) => {
    // Reset specific fields when ledger type changes, but keep safe defaults
    let newDebitCredit = "";
    if (value === "EXPENDITURES") newDebitCredit = "DR";
    if (value === "INCOME") newDebitCredit = "CR";
    if (value === "ASSETS") newDebitCredit = "DR";
    if (value === "LIABILITIES") newDebitCredit = "CR";
    
    const assetsParent = accounts.find(a => a.accountCode === "102000");
    
    setFormData({
      ...formData,
      ledgerType: value,
      accountName: "",     
      accountCode: "",    
      debitCredit: newDebitCredit,
      parentId: value === "ASSETS" && assetsParent ? assetsParent.id : "",
      level: value === "ASSETS" ? "3" : formData.level
    });
  };

  const handleCategorySelection = (categoryId: string, type: 'EXPENSE' | 'INCOME') => {
    const categories = type === 'EXPENSE' ? expenditureCategories : incomeCategories;
    const selected = categories.find(c => c.id === categoryId);
    
    if (selected) {
        // Auto-populate Name and Code
        // Attempt to generate a code if the category has one, otherwise try to be smart or generic
        let code = selected.code || "";
        
        // If no code, maybe generate one? For now let's rely on category.code or leave it empty but make it visible if empty?
        // User requested REMOVING the fields. So we must ensure we have values.
        // Fallback code generation strategy:
        if (!code) {
          const prefix = type === "EXPENSE" ? "5" : "4";
          code = `${prefix}${Date.now().toString().slice(-5)}`;
        }

        setFormData(prev => ({
            ...prev,
            accountName: selected.name,
            accountCode: code,
            category: selected.name // Store category name in the 'category' field usually
        }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountCode || !formData.accountName || !formData.ledgerType) {
      toast.error("Please fill in all required fields (Code, Name, Type)");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/v1/chart-of-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          level: parseInt(formData.level),
          parentId: formData.parentId || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Account created successfully");
        onSuccess();
        onOpenChange(false);
        // Reset form
        setFormData({
          accountCode: "",
          accountName: "",
          ledgerType: "",
          level: "3",
          parentId: "",
          category: "",
          product: "",
          currency: "UGX",
          debitCredit: "",
          description: "",
        });
      } else {
        toast.error(data.error || "Failed to create account");
      }
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  // Filter parent accounts based on selected level
  const availableParents = accounts.filter(acc => {
    const selectedLevel = parseInt(formData.level);
    if (selectedLevel === 1) return false;
    if (selectedLevel === 2) return acc.level === 1; 
    if (selectedLevel === 3) return acc.level === 2; 
    return false;
  });

  // Determine if specific fields should be hidden
  const isAutoPicked = formData.ledgerType === "EXPENDITURES" || formData.ledgerType === "INCOME";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {formData.ledgerType === "ASSETS" ? "Create New Asset" : 
             formData.ledgerType === "LIABILITIES" ? "Create New Liability" : 
             "Create New Account"}
          </DialogTitle>
          <DialogDescription>
            {formData.ledgerType ? `Details for ${formData.ledgerType}` : "Select a ledger type to begin"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Ledger Type - Moved to Top */}
          <div className="space-y-2">
            <Label htmlFor="ledgerType">
              Ledger Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.ledgerType}
              onValueChange={handleLedgerTypeChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type to begin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSETS">Assets</SelectItem>
                <SelectItem value="LIABILITIES">Liabilities</SelectItem>
                <SelectItem value="EQUITY">Equity</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENDITURES">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Rendering based on Ledger Type */}
          
          {/* EXPENSES / INCOME Selection */}
          {isAutoPicked && (
            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                <h3 className="font-medium text-sm text-slate-900">
                    {formData.ledgerType === 'EXPENSES' ? "Select Expenditure Item" : "Select Income Source"}
                </h3>
                
                {isLoadingCategories ? (
                     <div className="text-sm text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin inline"/> Loading categories...</div>
                ) : (
                    <Select onValueChange={(val) => handleCategorySelection(val, formData.ledgerType as 'EXPENSE' | 'INCOME')}>
                        <SelectTrigger>
                            <SelectValue placeholder={`Choose ${formData.ledgerType === 'EXPENSES' ? 'Expenditure' : 'Income'} Category...`} />
                        </SelectTrigger>
                        <SelectContent>
                            {(formData.ledgerType === 'EXPENSES' ? expenditureCategories : incomeCategories).map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                    {cat.code ? `${cat.code} - ` : ''}{cat.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                
                <p className="text-xs text-muted-foreground">
                    Selecting a category will automatically set the Account Name and Code.
                </p>
            </div>
          )}

          {/* Account Code & Name - Hidden if auto-picked, Shown for Assets/Liabilities/Etc */}
          {!isAutoPicked && formData.ledgerType && (
             <div className="grid grid-cols-2 gap-4">
               {/* Account Code */}
               <div className="space-y-2">
                 <Label htmlFor="accountCode">
                   Account Code <span className="text-red-500">*</span>
                 </Label>
                 <Input
                   id="accountCode"
                   placeholder="e.g., 102020"
                   value={formData.accountCode}
                   onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                   required={!isAutoPicked}
                 />
               </div>
   
               {/* Account Name */}
               <div className="space-y-2">
                 <Label htmlFor="accountName">
                   Account Name <span className="text-red-500">*</span>
                 </Label>
                 <Input
                   id="accountName"
                   placeholder="e.g., Office Rent"
                   value={formData.accountName}
                   onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                   required={!isAutoPicked}
                 />
               </div>
             </div>
          )}
          
          {/* Hidden inputs to hold values when they are hidden from UI but required by backend */}
          {isAutoPicked && (
             <div className="hidden">
                 <Input value={formData.accountCode} readOnly name="hiddenCode" />
                 <Input value={formData.accountName} readOnly name="hiddenName" />
             </div>
          )}

          {/* Level - Only show if not auto-picked? Or allow users to categorize Expenses deeper? 
              User request "simple form". Let's keep Level but maybe default it or hide it for simple expense picking?
              Let's keep it but put it lower.
          */}
          {formData.ledgerType && (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select
                    value={formData.level}
                    onValueChange={(value) => setFormData({ ...formData, level: value, parentId: "" })}
                >
                    <SelectTrigger>
                    <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="1">Level 1 (Main Category)</SelectItem>
                    <SelectItem value="2">Level 2 (Sub-Category)</SelectItem>
                    <SelectItem value="3">Level 3 (Account)</SelectItem>
                    </SelectContent>
                </Select>
                </div>

                {/* Parent Account */}
                {parseInt(formData.level) > 1 && (
                <div className="space-y-2">
                    <Label htmlFor="parentId">Parent Account</Label>
                    <Select
                    value={formData.parentId}
                    onValueChange={(value) => setFormData({ ...formData, parentId: value })}
                    >
                    <SelectTrigger>
                        <SelectValue placeholder="Select parent account" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableParents.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                            {acc.accountCode} - {acc.accountName}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
                )}
            </div>
          )}


          {/* Common Fields */}
          {formData.ledgerType && (
             <>
                 <div className="grid grid-cols-2 gap-4">
                    {/* Currency */}
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                            value={formData.currency}
                            onValueChange={(value) => setFormData({ ...formData, currency: value })}
                        >
                            <SelectTrigger>
                            <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="UGX">UGX</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Debit/Credit Type */}
                    <div className="space-y-2">
                    <Label htmlFor="debitCredit">Debit/Credit Type</Label>
                    <Select
                        value={formData.debitCredit}
                        onValueChange={(value) => setFormData({ ...formData, debitCredit: value })}
                    >
                        <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="DR">Debit (Dr)</SelectItem>
                        <SelectItem value="CR">Credit (Cr)</SelectItem>
                        <SelectItem value="BOTH">Both Debit & Credit</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Optional description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                    />
                </div>
             </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
