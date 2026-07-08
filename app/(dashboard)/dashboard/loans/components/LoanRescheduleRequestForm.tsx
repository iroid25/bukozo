// @ts-ignore
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
  Shield, 
  Users as UsersIcon, 
  Info,
  Plus,
  Trash2,
  Calculator
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { cn, formatCurrency } from "@/lib/utils";
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

const formSchema = z.object({
  loanId: z.string().min(1, "Please select a loan"),
  newDueDate: z.date({
    required_error: "New due date is required",
  }),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  
  // Personal & Address
  village: z.string().optional(),
  parish: z.string().optional(),
  county: z.string().optional(),
  spouseName: z.string().optional(),
  spouseContact: z.string().optional(),
  spouseNIN: z.string().optional(),
  
  // Reschedule Details
  rescheduleAmount: z.string().optional(),
  reschedulePeriod: z.string().optional(),
  
  // Security
  securityType: z.string().optional(),
  securityDescription: z.string().optional(),
  securityPurchasePrice: z.string().optional(),
  securityCurrentPrice: z.string().optional(),
  securityValuation: z.string().optional(),
  forcedSaleValue: z.string().optional(),
  
  // Guarantors
  guarantors: z.array(z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
  })).optional(),
  
  officerComment: z.string().optional(),
  loanOfficerId: z.string().min(1, "Please select an officer"),
});

interface LoanOption {
  id: string;
  label: string;
  dueDate: Date;
  outstandingBalance: number;
  disbursementDate: Date;
  interestRate: number;
  interestPeriod: string;
  loanApplication: any;
  member: any;
}

interface LoanRescheduleRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoanRescheduleRequestForm({
  isOpen,
  onClose,
}: LoanRescheduleRequestFormProps) {
  const router = useRouter();
  const [loans, setLoans] = useState<LoanOption[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [openOfficerCombo, setOpenOfficerCombo] = useState(false);
  const [officers, setOfficers] = useState<{ id: string; name: string }[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loanId: "",
      reason: "",
      guarantors: [{ name: "" }],
      loanOfficerId: "",
    },
  });

  const selectedLoanId = form.watch("loanId");
  const selectedLoan = loans.find((l: LoanOption) => l.id === selectedLoanId);

  useEffect(() => {
    if (isOpen) {
      const fetchLoans = async () => {
        try {
          setLoadingLoans(true);
          const res = await fetch("/api/v1/loans?status=DISBURSED,OVERDUE&limit=100");
          const data = await res.json();

          if (data.success && Array.isArray(data.data)) {
            const options = data.data.map((loan: any) => {
              const memberName = loan.member?.user?.name || "Unknown Member";
              const memberNum = loan.member?.memberNumber || "N/A";
              const amount = Number(loan.amountGranted || 0).toLocaleString();
              
              return {
                id: loan.id,
                label: `${memberName} (${memberNum}) - UGX ${amount}`,
                dueDate: loan.dueDate ? new Date(loan.dueDate) : new Date(),
                outstandingBalance: Number(loan.outstandingBalance || 0),
                disbursementDate: loan.disbursementDate ? new Date(loan.disbursementDate) : new Date(),
                interestRate: loan.interestRate,
                interestPeriod: loan.interestPeriod,
                loanApplication: loan.loanApplication,
                member: loan.member,
              };
            });
            setLoans(options);
          } else {
            console.error("Failed to fetch loans or invalid data format:", data);
            toast.error(data.error || "Failed to load active loans");
          }
        } catch (error) {
          console.error("Failed to fetch loans", error);
          toast.error("Failed to load loans");
        } finally {
          setLoadingLoans(false);
        }
      };

      const fetchOfficers = async () => {
        try {
          setLoadingOfficers(true);
          const res = await fetch("/api/v1/users");
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            const staff = data.data
              .filter((u: any) => ["ADMIN", "BRANCHMANAGER", "LOANOFFICER", "ACCOUNTANT"].includes(u.role) && u.isActive)
              .map((u: any) => ({
                id: u.id,
                name: u.name || `${u.firstName} ${u.lastName}`,
              }));
            setOfficers(staff);
          }
        } catch (error) {
          console.error("Failed to fetch officers", error);
        } finally {
          setLoadingOfficers(false);
        }
      };

      fetchLoans();
      fetchOfficers();
      form.reset({
          loanId: "",
          reason: "",
          guarantors: [{ name: "" }],
          loanOfficerId: "",
      });
      setActiveTab("info");
    }
  }, [isOpen, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/v1/loans/${values.loanId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          rescheduleAmount: values.rescheduleAmount ? parseFloat(values.rescheduleAmount) : undefined,
          securityPurchasePrice: values.securityPurchasePrice ? parseFloat(values.securityPurchasePrice) : undefined,
          securityCurrentPrice: values.securityCurrentPrice ? parseFloat(values.securityCurrentPrice) : undefined,
          securityValuation: values.securityValuation ? parseFloat(values.securityValuation) : undefined,
          forcedSaleValue: values.forcedSaleValue ? parseFloat(values.forcedSaleValue) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      toast.success("Reschedule request submitted successfully");
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
    form.setValue("guarantors", [...current, { name: "" }]);
  };

  const removeGuarantor = (index: number) => {
    const current = form.getValues("guarantors") || [];
    form.setValue("guarantors", current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <Calculator className="h-5 w-5" /> LOAN RE-SCHEDULING APPLICATION FORM
          </DialogTitle>
          <DialogDescription>
            Please complete all sections for interest and principal reschedule request.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 border-b shrink-0 bg-slate-50/50">
                <TabsList className="grid grid-cols-6 w-full bg-slate-100 p-1 h-auto">
                  <TabsTrigger value="info" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("info")}>Status</TabsTrigger>
                  <TabsTrigger value="personal" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("personal")}>Personal</TabsTrigger>
                  <TabsTrigger value="details" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("details")}>Reschedule</TabsTrigger>
                  <TabsTrigger value="security" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("security")}>Security</TabsTrigger>
                  <TabsTrigger value="installments" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("installments")}>Installments</TabsTrigger>
                  <TabsTrigger value="guarantors" className="text-[10px] py-2 data-[state=active]:bg-white" onClick={() => setActiveTab("guarantors")}>Guarantors</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 p-6">
                <div className="overflow-y-auto">
                <TabsContent value="info" className="m-0 space-y-4">
                  <FormField
                    control={form.control}
                    name="loanId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Select Loan *</FormLabel>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? loans.find((l) => l.id === field.value)?.label : loadingLoans ? "Loading..." : "Search member or loan ID..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[650px] p-0">
                            <Command>
                              <CommandInput placeholder="Search member name, ID or amount..." />
                              <CommandList>
                                <CommandEmpty>No disbursed loan found.</CommandEmpty>
                                <CommandGroup>
                                  {loans.map((loan) => (
                                    <CommandItem
                                      key={loan.id}
                                      value={loan.label}
                                      onSelect={() => {
                                        form.setValue("loanId", loan.id);
                                        setOpenCombobox(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", loan.id === field.value ? "opacity-100" : "opacity-0")} />
                                      {loan.label}
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

                  {selectedLoan && (
                    <div className="grid grid-cols-2 gap-4 rounded-xl border bg-muted/30 p-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Member Name</p>
                        <p className="font-semibold">{selectedLoan.member?.user?.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Loan Purpose</p>
                        <p className="font-semibold">{selectedLoan.loanApplication?.purpose || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Disbursement Date</p>
                        <p className="font-semibold">{format(selectedLoan.disbursementDate, "PPP")}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Current Due Date</p>
                        <p className="font-semibold text-orange-600">{format(selectedLoan.dueDate, "PPP")}</p>
                      </div>
                      <div className="col-span-2 space-y-1 border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Outstanding Balance</p>
                        <p className="font-bold text-2xl">UGX {selectedLoan.outstandingBalance.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Brief Reason (Overview) *</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Brief summary of why rescheduling is needed..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="personal" className="m-0 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-primary border-b pb-1"><Home className="h-4 w-4" /> CURRENT ADDRESS</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="village" render={({ field }) => (
                        <FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="parish" render={({ field }) => (
                        <FormItem><FormLabel>Parish</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="county" render={({ field }) => (
                        <FormItem><FormLabel>County / T.Council</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-primary border-b pb-1"><User className="h-4 w-4" /> SPOUSE / NEXT OF KIN</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="spouseName" render={({ field }) => (
                        <FormItem><FormLabel>Name of Spouse/Kin</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="spouseContact" render={({ field }) => (
                        <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="spouseNIN" render={({ field }) => (
                        <FormItem><FormLabel>Spouse NIN</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  </div>
                </TabsContent>

                 <TabsContent value="details" className="m-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="loanOfficerId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Handling Loan Officer *</FormLabel>
                          <Popover open={openOfficerCombo} onOpenChange={setOpenOfficerCombo}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                >
                                  {field.value ? officers.find((o: { id: string; name: string }) => o.id === field.value)?.name : loadingOfficers ? "Loading..." : "Select officer..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[650px] p-0">
                              <Command>
                                <CommandInput placeholder="Search officer..." />
                                <CommandList>
                                  <CommandEmpty>No officer found.</CommandEmpty>
                                  <CommandGroup>
                                    {officers.map((officer: { id: string; name: string }) => (
                                      <CommandItem
                                        key={officer.id}
                                        value={officer.name}
                                        onSelect={() => {
                                          form.setValue("loanOfficerId", officer.id);
                                          setOpenOfficerCombo(false);
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                   <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="rescheduleAmount" render={({ field }) => (
                        <FormItem><FormLabel>Amount to be Rescheduled</FormLabel><FormControl><Input type="number" placeholder="Leave blank for full balance" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="reschedulePeriod" render={({ field }) => (
                        <FormItem><FormLabel>Requested Period (e.g. 6 Months)</FormLabel><FormControl><Input placeholder="Duration..." {...field} /></FormControl></FormItem>
                      )} />
                   </div>
                   
                   <FormField
                    control={form.control}
                    name="newDueDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Requested Disbursement Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Requested Disbursement Date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date: Date) => date < new Date() || (selectedLoan ? date <= selectedLoan.dueDate : false)} initialFocus />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="security" className="m-0 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="securityType" render={({ field }) => (
                        <FormItem><FormLabel>Type of Security</FormLabel><FormControl><Input placeholder="e.g. Land Title, Logbook" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="securityPurchasePrice" render={({ field }) => (
                        <FormItem><FormLabel>Purchase Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                      )} />
                   </div>
                   <FormField control={form.control} name="securityDescription" render={({ field }) => (
                        <FormItem><FormLabel>Description of Security</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                      )} />
                   <div className="grid grid-cols-3 gap-4">
                      <FormField control={form.control} name="securityCurrentPrice" render={({ field }) => (
                        <FormItem><FormLabel>Current Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="securityValuation" render={({ field }) => (
                        <FormItem><FormLabel>Client Valuation</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="forcedSaleValue" render={({ field }) => (
                        <FormItem><FormLabel>Est. Forced Sale Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                      )} />
                   </div>
                </TabsContent>

                <TabsContent value="installments" className="m-0 space-y-4 h-full flex flex-col">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-primary"><CalendarIcon className="h-4 w-4" /> PROJECTED INSTALLMENTS</h3>
                    <div className="text-[10px] text-muted-foreground italic">Based on requested reschedule period</div>
                  </div>
                  
                  {selectedLoan ? (
                    <div className="flex-1 overflow-hidden flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-md border text-xs">
                        <div>
                           <p className="text-muted-foreground">Original Due Date</p>
                           <p className="font-bold">{format(selectedLoan.dueDate, "PPP")}</p>
                        </div>
                        <div>
                           <p className="text-muted-foreground">Outstanding Balance</p>
                           <p className="font-bold text-red-600">{formatCurrency(selectedLoan.outstandingBalance)}</p>
                        </div>
                      </div>

                      <ScrollArea className="flex-1 border rounded-md">
                        <table className="w-full text-[10px]">
                          <thead className="bg-slate-50 sticky top-0">
                            <tr className="border-b">
                              <th className="px-2 py-2 text-left">No.</th>
                              <th className="px-2 py-2 text-left">Due Date</th>
                              <th className="px-2 py-2 text-right">Principal</th>
                              <th className="px-2 py-2 text-right">Interest</th>
                              <th className="px-2 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const amount = Number(form.watch("rescheduleAmount")) || selectedLoan.outstandingBalance;
                              const periodStr = form.watch("reschedulePeriod") || "0";
                              const period = parseInt(periodStr.match(/\d+/)?.[0] || "1");
                              const rate = selectedLoan.interestRate || selectedLoan.loanApplication?.loanProduct?.interestRate || 0;
                              const interestPeriod = selectedLoan.interestPeriod || selectedLoan.loanApplication?.loanProduct?.interestPeriod || "MONTHLY";
                              const effectiveMonthlyRate = interestPeriod === "ANNUAL" ? rate / 12 : rate;
                              const startDate = form.watch("newDueDate") || new Date();
                              
                              const monthlyPrincipal = amount / period;
                              const monthlyInterest = amount * (effectiveMonthlyRate / 100);
                              const items = [];
                              
                              for (let i = 0; i < period; i++) {
                                const d = new Date(startDate);
                                d.setMonth(d.getMonth() + i);
                                items.push(
                                  <tr key={i} className="border-b hover:bg-slate-50">
                                    <td className="px-2 py-2">{i+1}</td>
                                    <td className="px-2 py-2">{format(d, "dd MMM yyyy")}</td>
                                    <td className="px-2 py-2 text-right font-medium">{formatCurrency(monthlyPrincipal)}</td>
                                    <td className="px-2 py-2 text-right text-muted-foreground">{formatCurrency(monthlyInterest)}</td>
                                    <td className="px-2 py-2 text-right font-bold">{formatCurrency(monthlyPrincipal + monthlyInterest)}</td>
                                  </tr>
                                );
                              }
                              return items;
                            })()}
                          </tbody>
                        </table>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-12 text-muted-foreground italic text-sm">
                      Please select a loan first
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="guarantors" className="m-0 space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-primary"><UsersIcon className="h-4 w-4" /> GUARANTORS</h3>
                    <Button type="button" variant="outline" size="sm" onClick={addGuarantor}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  <div className="space-y-3">
                    {form.watch("guarantors")?.map((_, index) => (
                       <div key={index} className="flex gap-2 items-end">
                         <div className="flex-1">
                            <FormField control={form.control} name={`guarantors.${index}.name`} render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Guarantor Name #{index+1}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                         </div>
                         <Button type="button" variant="ghost" size="icon" className="text-destructive h-10" onClick={() => removeGuarantor(index)} disabled={index === 0}><Trash2 className="h-4 w-4" /></Button>
                       </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t">
                    <FormField control={form.control} name="officerComment" render={({ field }) => (
                        <FormItem><FormLabel>Loans Officer Preliminary Comment</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                </TabsContent>
                </div>
              </ScrollArea>

              <DialogFooter className="p-6 pt-2 border-t mt-auto shrink-0 bg-white">
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                 {activeTab !== "guarantors" ? (
                    <Button type="button" onClick={() => {
                       const tabs = ["info", "personal", "details", "security", "installments", "guarantors"];
                       const currentIndex = tabs.indexOf(activeTab);
                       if (currentIndex < tabs.length - 1) {
                          setActiveTab(tabs[currentIndex + 1]);
                       }
                    }}>Next Section</Button>
                ) : (
                   <Button type="submit" disabled={isSubmitting || !selectedLoanId}>
                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     Submit Final Application
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

