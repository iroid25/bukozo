"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  CalendarIcon, 
  Loader2, 
  Check, 
  ChevronsUpDown, 
  User, 
  Home, 
  Users as UsersIcon, 
  Plus,
  Trash2,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NumberInput } from "@/components/ui/number-input";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  loanProductId: z.string().min(1, "Please select a loan product"),
  dateDisbursed: z.date({
    required_error: "Disbursement date is required",
  }),
  
  // Outstanding Balance Breakdown
  principleAmount: z.number().min(1, "Principle amount is required"),
  interestAmount: z.number().min(0, "Interest amount must be 0 or greater"),
  penaltiesAmount: z.number().min(0, "Penalties amount must be 0 or greater"),
  
  // Period Specification
  originalPeriodMonths: z.number().min(1, "Original period is required"),
  currentPeriodMonths: z.number().min(0, "Current period is required"),
  
  // Loan Details
  interestRate: z.number().min(0, "Interest rate is required"),
  interestPeriod: z.enum(["MONTHLY", "ANNUAL"]),
  
  // Collateral
  collateralType: z.string().optional(),
  collateralValue: z.number().optional(),
  collateralLocation: z.string().optional(),
  collateralDetails: z.string().optional(),
  forcedSaleValue: z.number().optional(),
  
  // Guarantors (array of member IDs)
  guarantors: z.array(z.object({
    memberId: z.string().min(1, "Please select a guarantor"),
    name: z.string(),
    memberNumber: z.string(),
  })).optional(),
  
  notes: z.string().optional(),
  branchId: z.string().optional(),
  loanOfficerId: z.string().min(1, "Please select an officer"),
});

interface Member {
  id: string;
  name: string;
  memberNumber: string;
  phone?: string;
  email?: string;
}

interface LoanProduct {
  id: string;
  name: string;
  interestRate: number;
  minAmount: number;
  maxAmount: number;
}

interface LoanMigrationFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoanMigrationForm({
  isOpen,
  onClose,
}: LoanMigrationFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openMemberCombobox, setOpenMemberCombobox] = useState(false);
  const [openProductCombobox, setOpenProductCombobox] = useState(false);
  const [openOfficerCombobox, setOpenOfficerCombobox] = useState(false);
  const [openGuarantorCombobox, setOpenGuarantorCombobox] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("member");
  const [hasPermission, setHasPermission] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      principleAmount: 0,
      interestAmount: 0,
      penaltiesAmount: 0,
      originalPeriodMonths: 12,
      currentPeriodMonths: 0,
      interestRate: 0,
      interestPeriod: "MONTHLY",
      collateralValue: 0,
      forcedSaleValue: 0,
      guarantors: [],
      loanOfficerId: session?.user?.id || "",
    },
  });

  // Check user permissions
  useEffect(() => {
    if (session?.user) {
      const userRole = (session.user as any).role;
      const allowed = ["ADMIN", "BRANCHMANAGER", "LOANOFFICER"].includes(userRole);
      setHasPermission(allowed);
      
      if (!allowed) {
        toast.error("Access Denied: Only Admin, Branch Managers, and Loan Officers can migrate loans");
      }
    }
  }, [session]);

  // Fetch members and loan products
  useEffect(() => {
    if (isOpen && hasPermission) {
      fetchMembers();
      fetchLoanProducts();
      fetchOfficers();
      form.reset({
        principleAmount: 0,
        interestAmount: 0,
        penaltiesAmount: 0,
        originalPeriodMonths: 12,
        currentPeriodMonths: 0,
        interestRate: 0,
        interestPeriod: "MONTHLY",
        collateralValue: 0,
        forcedSaleValue: 0,
        guarantors: [],
        loanOfficerId: session?.user?.id || "",
      });
      setActiveTab("member");
    }
  }, [isOpen, hasPermission, form, session]);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await fetch("/api/v1/members");
      const data = await res.json();

      if (data.data && Array.isArray(data.data)) {
        const memberOptions = data.data.map((member: any) => ({
          id: member.id,
          name: member.user?.name || "Unknown",
          memberNumber: member.memberNumber || "N/A",
          phone: member.user?.phone,
          email: member.user?.email,
        }));
        setMembers(memberOptions);
      } else {
        toast.error("Failed to load members");
      }
    } catch (error) {
      console.error("Failed to fetch members", error);
      toast.error("Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchLoanProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await fetch("/api/v1/loans/products");
      const data = await res.json();

      if (Array.isArray(data)) {
        setLoanProducts(data);
      } else {
        toast.error("Failed to load loan products");
      }
    } catch (error) {
      console.error("Failed to fetch loan products", error);
      toast.error("Failed to load loan products");
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchOfficers = async () => {
    try {
      setLoadingOfficers(true);
      const res = await fetch("/api/v1/users");
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const staffRoles = ["ADMIN", "BRANCHMANAGER", "LOANOFFICER", "TELLER", "ACCOUNTANT"];
        const officerOptions = data.data
          .filter((u: any) => staffRoles.includes(u.role) && u.isActive)
          .map((u: any) => ({
            id: u.id,
            name: u.name || `${u.firstName} ${u.lastName}`,
          }));
        setOfficers(officerOptions);
      }
    } catch (error) {
      console.error("Failed to fetch officers", error);
    } finally {
      setLoadingOfficers(false);
    }
  };

  // Calculate total outstanding balance
  const calculateOutstanding = () => {
    const principle = form.watch("principleAmount") || 0;
    const interest = form.watch("interestAmount") || 0;
    const penalties = form.watch("penaltiesAmount") || 0;
    return principle + interest + penalties;
  };

  // Auto-fill interest rate when product is selected
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "loanProductId" && value.loanProductId) {
        const product = loanProducts.find(p => p.id === value.loanProductId);
        if (product) {
          form.setValue("interestRate", product.interestRate);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, loanProducts]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);

      const outstandingBalance = calculateOutstanding();
      const amountGranted = values.principleAmount;

      const payload = {
        memberId: values.memberId,
        loanProductId: values.loanProductId,
        amountGranted,
        dateDisbursed: values.dateDisbursed.toISOString(),
        outstandingBalance,
        repaymentPeriodMonths: values.originalPeriodMonths,
        interestRate: values.interestRate,
        interestPeriod: values.interestPeriod,
        
        // Breakdown
        principleAmount: values.principleAmount,
        interestAmount: values.interestAmount,
        penaltiesAmount: values.penaltiesAmount,
        
        // Period
        originalPeriodMonths: values.originalPeriodMonths,
        currentPeriodMonths: values.currentPeriodMonths,
        
        // Collateral
        collateralType: values.collateralType,
        collateralValue: values.collateralValue,
        collateralLocation: values.collateralLocation,
        collateralDetails: values.collateralDetails,
        forcedSaleValue: values.forcedSaleValue,
        
        // Guarantors
        guarantors: values.guarantors?.map(g => ({
          name: g.name,
          memberNumber: g.memberNumber,
          memberId: g.memberId,
        })) || [],
        
        notes: values.notes,
        branchId: values.branchId || (session?.user as any)?.branchId,
        loanOfficerId: values.loanOfficerId,
      };

      const res = await fetch("/api/v1/loans/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to migrate loan");

      toast.success("Legacy loan migrated successfully");
      form.reset();
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addGuarantor = () => {
    const current = form.getValues("guarantors") || [];
    form.setValue("guarantors", [...current, { memberId: "", name: "", memberNumber: "" }]);
  };

  const removeGuarantor = (index: number) => {
    const current = form.getValues("guarantors") || [];
    form.setValue("guarantors", current.filter((_, i) => i !== index));
  };

  const selectedMember = members.find(m => m.id === form.watch("memberId"));
  const selectedProduct = loanProducts.find(p => p.id === form.watch("loanProductId"));

  if (!hasPermission) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-destructive">Access Denied</DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Only Admin and Branch Managers are authorized to migrate legacy loans.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-2xl font-bold">Legacy Loan Migration</DialogTitle>
          <DialogDescription>
            Import loan records from previous system - BUKONZO UNITED TEACHERS' SACCO
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
              <div className="px-6 border-b shrink-0 bg-background z-10">
                <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-6">
                  <TabsTrigger value="member" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 py-2">Member & Product</TabsTrigger>
                  <TabsTrigger value="balance" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 py-2">Outstanding Balance</TabsTrigger>
                  <TabsTrigger value="period" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 py-2">Loan Period</TabsTrigger>
                  <TabsTrigger value="collateral" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 py-2">Collateral</TabsTrigger>
                  <TabsTrigger value="guarantors" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 py-2">Guarantors</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {/* Tab 1: Member & Product */}
                  <TabsContent value="member" className="m-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="memberId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Select Member *</FormLabel>
                          <Popover open={openMemberCombobox} onOpenChange={setOpenMemberCombobox}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? members.find((m) => m.id === field.value)?.name : loadingMembers ? "Loading..." : "Search member..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[700px] p-0">
                              <Command>
                                <CommandInput placeholder="Search member name or number..." />
                                <CommandList>
                                  <CommandEmpty>No member found.</CommandEmpty>
                                  <CommandGroup>
                                    {members.map((member) => (
                                      <CommandItem
                                        key={member.id}
                                        value={`${member.name} ${member.memberNumber}`}
                                        onSelect={() => {
                                          form.setValue("memberId", member.id);
                                          setOpenMemberCombobox(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", member.id === field.value ? "opacity-100" : "opacity-0")} />
                                        <div className="flex-1">
                                          <div className="font-medium">{member.name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {member.memberNumber} {member.phone && `• ${member.phone}`}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedMember && (
                      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Member Number</p>
                          <p className="font-semibold">{selectedMember.memberNumber}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Contact</p>
                          <p className="font-semibold">{selectedMember.phone || selectedMember.email || 'N/A'}</p>
                        </div>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="loanOfficerId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Assigned Loan Officer *</FormLabel>
                          <Popover open={openOfficerCombobox} onOpenChange={setOpenOfficerCombobox}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? (officers as any[]).find((o) => o.id === field.value)?.name : loadingOfficers ? "Loading..." : "Select officer..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[700px] p-0">
                              <Command>
                                <CommandInput placeholder="Search officer name..." />
                                <CommandList>
                                  <CommandEmpty>No officer found.</CommandEmpty>
                                  <CommandGroup>
                                    {officers.map((officer: { id: string; name: string }) => (
                                      <CommandItem
                                        key={officer.id}
                                        value={officer.name}
                                        onSelect={() => {
                                          form.setValue("loanOfficerId", officer.id);
                                          setOpenOfficerCombobox(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", officer.id === field.value ? "opacity-100" : "opacity-0")} />
                                        {officer.name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            This officer will be able to see this loan in their specific reports.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="loanProductId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Loan Product *</FormLabel>
                          <Popover open={openProductCombobox} onOpenChange={setOpenProductCombobox}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? loanProducts.find((p) => p.id === field.value)?.name : loadingProducts ? "Loading..." : "Select loan product..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[700px] p-0">
                              <Command>
                                <CommandInput placeholder="Search loan product..." />
                                <CommandList>
                                  <CommandEmpty>No product found.</CommandEmpty>
                                  <CommandGroup>
                                    {loanProducts.map((product) => (
                                      <CommandItem
                                        key={product.id}
                                        value={product.name}
                                        onSelect={() => {
                                          form.setValue("loanProductId", product.id);
                                          setOpenProductCombobox(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", product.id === field.value ? "opacity-100" : "opacity-0")} />
                                        <div className="flex-1">
                                          <div className="font-medium">{product.name}</div>
                                          <div className="text-sm text-muted-foreground">
                                            Interest: {product.interestRate}% • Range: UGX {product.minAmount.toLocaleString()} - {product.maxAmount.toLocaleString()}
                                          </div>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dateDisbursed"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Original Disbursement Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                  {field.value ? format(field.value, "PPP") : <span>Pick disbursement date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar 
                                mode="single" 
                                selected={field.value} 
                                onSelect={field.onChange} 
                                disabled={(date) => date > new Date()}
                                initialFocus 
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="interestRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interest Rate (%) *</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              allowDecimal
                              maxDecimals={2}
                            />
                          </FormControl>
                          <FormDescription>Auto-filled from loan product, can be adjusted</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="interestPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interest Period *</FormLabel>
                          <FormControl>
                            <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="MONTHLY">Monthly</TabsTrigger>
                                <TabsTrigger value="ANNUAL">Annual</TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </FormControl>
                          <FormDescription>Is the {form.watch("interestRate")}% interest charged per month or per year?</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  {/* Tab 2: Outstanding Balance */}
                  <TabsContent value="balance" className="m-0 space-y-4">
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-lg">Outstanding Balance Breakdown</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Specify the current outstanding balance by breaking it down into principle, interest, and penalties.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="principleAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Principle Amount (UGX) *</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              placeholder="1,000,000"
                            />
                          </FormControl>
                          <FormDescription>Original loan amount still outstanding</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="interestAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Interest Amount (UGX)</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              placeholder="200,000"
                            />
                          </FormControl>
                          <FormDescription>Accrued interest not yet paid</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="penaltiesAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Penalties Amount (UGX)</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              placeholder="50,000"
                            />
                          </FormControl>
                          <FormDescription>Late payment penalties or fees</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-emerald-900">Total Outstanding Balance:</span>
                        <span className="text-2xl font-bold text-emerald-600">
                          UGX {calculateOutstanding().toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-2">
                        This is the sum of principle, interest, and penalties
                      </p>
                    </div>
                  </TabsContent>

                  {/* Tab 3: Loan Period */}
                  <TabsContent value="period" className="m-0 space-y-4">
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 mb-4">
                      <h3 className="font-bold text-lg mb-2">Loan Period Specification</h3>
                      <p className="text-sm text-muted-foreground">
                        Specify both the original loan period and the current/remaining period.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="originalPeriodMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Original Loan Period (Months) *</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              placeholder="12"
                            />
                          </FormControl>
                          <FormDescription>The original repayment period when loan was disbursed</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currentPeriodMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current/Remaining Period (Months)</FormLabel>
                          <FormControl>
                            <NumberInput 
                              value={field.value} 
                              onValueChange={field.onChange}
                              placeholder="6"
                            />
                          </FormControl>
                          <FormDescription>Months remaining or months elapsed (0 if fully matured)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4 mt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Original Period</p>
                        <p className="text-2xl font-bold">{form.watch("originalPeriodMonths") || 0} months</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Current Period</p>
                        <p className="text-2xl font-bold">{form.watch("currentPeriodMonths") || 0} months</p>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 4: Collateral */}
                  <TabsContent value="collateral" className="m-0 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="collateralType" render={({ field }) => (
                        <FormItem><FormLabel>Type of Collateral</FormLabel><FormControl><Input placeholder="e.g. Land Title, Logbook" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="collateralValue" render={({ field }) => (
                        <FormItem><FormLabel>Collateral Value (UGX)</FormLabel><FormControl><NumberInput value={field.value} onValueChange={field.onChange} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="collateralDetails" render={({ field }) => (
                        <FormItem><FormLabel>Description of Collateral</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="collateralLocation" render={({ field }) => (
                        <FormItem><FormLabel>Collateral Location</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="forcedSaleValue" render={({ field }) => (
                        <FormItem><FormLabel>Est. Forced Sale Value (UGX)</FormLabel><FormControl><NumberInput value={field.value} onValueChange={field.onChange} /></FormControl></FormItem>
                      )} />
                    </div>
                  </TabsContent>

                  {/* Tab 5: Guarantors */}
                  <TabsContent value="guarantors" className="m-0 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-bold flex items-center gap-2 text-primary"><UsersIcon className="h-4 w-4" /> GUARANTORS</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addGuarantor}><Plus className="h-3 w-3 mr-1" /> Add Guarantor</Button>
                    </div>
                    <div className="space-y-3">
                      {form.watch("guarantors")?.map((_, index) => (
                        <div key={index} className="flex gap-2 items-end border rounded-lg p-3">
                          <div className="flex-1">
                            <FormField 
                              control={form.control} 
                              name={`guarantors.${index}.memberId`} 
                              render={({ field }) => (
                                <FormItem className="flex flex-col">
                                  <FormLabel className="text-xs">Guarantor #{index + 1}</FormLabel>
                                  <Popover open={openGuarantorCombobox === index} onOpenChange={(open) => setOpenGuarantorCombobox(open ? index : null)}>
                                    <PopoverTrigger asChild>
                                      <FormControl>
                                        <Button
                                          variant="outline"
                                          role="combobox"
                                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                          {field.value ? members.find((m) => m.id === field.value)?.name : "Search member..."}
                                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                      </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[500px] p-0">
                                      <Command>
                                        <CommandInput placeholder="Search guarantor..." />
                                        <CommandList>
                                          <CommandEmpty>No member found.</CommandEmpty>
                                          <CommandGroup>
                                            {members.map((member) => (
                                              <CommandItem
                                                key={member.id}
                                                value={`${member.name} ${member.memberNumber}`}
                                                onSelect={() => {
                                                  form.setValue(`guarantors.${index}.memberId`, member.id);
                                                  form.setValue(`guarantors.${index}.name`, member.name);
                                                  form.setValue(`guarantors.${index}.memberNumber`, member.memberNumber);
                                                  setOpenGuarantorCombobox(null);
                                                }}
                                              >
                                                <Check className={cn("mr-2 h-4 w-4", member.id === field.value ? "opacity-100" : "opacity-0")} />
                                                <div>
                                                  <div className="font-medium">{member.name}</div>
                                                  <div className="text-sm text-muted-foreground">{member.memberNumber}</div>
                                                </div>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                  <FormMessage />
                                </FormItem>
                              )} 
                            />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-destructive h-10" onClick={() => removeGuarantor(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      {(!form.watch("guarantors") || form.watch("guarantors")?.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <UsersIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No guarantors added yet</p>
                          <p className="text-sm">Click "Add Guarantor" to add guarantors</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t">
                      <FormField control={form.control} name="notes" render={({ field }) => (
                          <FormItem><FormLabel>Migration Notes</FormLabel><FormControl><Textarea placeholder="Any additional notes about this legacy loan..." {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  </TabsContent>
                </div>
              </div>

              <DialogFooter className="p-6 pt-2 border-t mt-auto shrink-0 bg-background z-10">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                {activeTab !== "guarantors" ? (
                  <Button type="button" onClick={() => {
                    const tabs = ["member", "balance", "period", "collateral", "guarantors"];
                    const next = tabs[tabs.indexOf(activeTab) + 1];
                    setActiveTab(next);
                  }}>Next Section</Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Migrate Legacy Loan
                  </Button>
                )}
              </DialogFooter>
            </Tabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
