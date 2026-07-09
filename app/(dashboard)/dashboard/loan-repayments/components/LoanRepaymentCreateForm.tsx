//   mobileMoneyRef?: string;
// }

// interface LoanRepaymentCreateFormProps {
//   isOpen: boolean;
//   onClose: () => void;
//   currentUserId: string;
// }

// export default function LoanRepaymentCreateForm({
//   isOpen,
//   onClose,
//   currentUserId,
// }: LoanRepaymentCreateFormProps) {
//   const {
//     register,
//     handleSubmit,
//     reset,
//     setValue,
//     watch,
//     formState: { errors },
//   } = useForm<LoanRepaymentFormData>({
//     defaultValues: {
//       loanId: "",
//       amount: "",
//       channel: "",
//       mobileMoneyRef: "",
//     },
//   });

//   const [loading, setLoading] = useState(false);
//   const [fetchingLoans, setFetchingLoans] = useState(false);
//   const [activeLoans, setActiveLoans] = useState<ActiveLoan[]>([]);
//   const [loanSearchOpen, setLoanSearchOpen] = useState(false);
//   const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
//   const [fetchError, setFetchError] = useState<string>("");

//   const router = useRouter();
//   const watchedAmount = watch("amount");
//   const watchedChannel = watch("channel");
//   const watchedMobileRef = watch("mobileMoneyRef");

//   // Format currency
//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-UG", {
//       style: "currency",
//       currency: "UGX",
//       minimumFractionDigits: 0,
//     }).format(amount);
//   };

//   // Format date
//   const formatDate = (date: Date | string) => {
//     return new Date(date).toLocaleDateString("en-UG", {
//       year: "numeric",
//       month: "short",
//       day: "numeric",
//     });
//   };
  
//   const watchedVoucherNumber = watch("voucherNumber");

//   // Load active loans when modal opens
//   useEffect(() => {
//     if (isOpen) {
//       console.log("🔄 Modal opened, loading active loans...");
//       loadActiveLoans();
//     } else {
//       // Reset form when closing
//       handleReset();
//     }
//   }, [isOpen]);

//   const loadActiveLoans = async () => {
//     setFetchingLoans(true);
//     setFetchError("");

//     try {
//       console.log("📞 Fetching active loans from API...");
//       const response = await fetch("/api/loans/active-for-repayment", {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         cache: "no-store", // Don't cache to always get fresh data
//       });

//       console.log("📥 Response status:", response.status);

//       const data = await response.json();
//       console.log("📦 Response data:", data);

//       if (!response.ok) {
//         throw new Error(
//           data.error || `HTTP ${response.status}: Failed to fetch loans`
//         );
//       }

//       if (!data.success) {
//         throw new Error(data.error || "API returned success: false");
//       }

//       console.log("✅ Active loans loaded successfully:", data.count, "loans");
//       console.log("📋 Loans:", data.loans);

//       setActiveLoans(data.loans || []);

//       if (data.count === 0) {
//         setFetchError("No active loans found");
//         toast.info("No Active Loans", {
//           description: "There are currently no loans available for repayment.",
//         });
//       }
//     } catch (error) {
//       console.error("💥 Error loading active loans:", error);
//       const errorMessage =
//         error instanceof Error ? error.message : "Unknown error occurred";
//       setFetchError(errorMessage);

//       toast.error("Failed to Load Loans", {
//         description: errorMessage,
//       });
//       setActiveLoans([]);
//     } finally {
//       setFetchingLoans(false);
//     }
//   };

//   // Check if loan is overdue
//   const isLoanOverdue = (dueDate: Date | string) => {
//     return new Date() > new Date(dueDate);
//   };

//   // Calculate repayment impact
//   const getRepaymentImpact = () => {
//     if (!selectedLoan || !watchedAmount) return null;

//     const amount = Number(watchedAmount);
//     if (amount <= 0 || isNaN(amount)) return null;

//     const newBalance = Math.max(0, selectedLoan.outstandingBalance - amount);
//     const overpayment = Math.max(0, amount - selectedLoan.outstandingBalance);
//     const percentagePaid = Math.min(
//       100,
//       (amount / selectedLoan.outstandingBalance) * 100
//     );
//     const isFullyPaid = newBalance === 0;

//     return {
//       newBalance,
//       percentagePaid,
//       isFullyPaid,
//       overpayment,
//     };
//   };

//   // Handle loan selection
//   const handleLoanSelect = (loan: ActiveLoan) => {
//     console.log("🎯 Loan selected:", {
//       id: loan.id,
//       member: loan.member.user.name,
//       outstanding: loan.outstandingBalance,
//     });

//     setSelectedLoan(loan);
//     setValue("loanId", loan.id);
//     setValue("amount", loan.outstandingBalance.toString());
//     setLoanSearchOpen(false);

//     console.log("✅ Form values updated");
//   };

//   // Submit repayment
//   async function saveRepayment(data: LoanRepaymentFormData) {
//     console.log("🚀 Form submission started");
//     console.log("📝 Form data:", data);
//     console.log("👤 Current user ID:", currentUserId);
//     console.log("💳 Selected loan:", selectedLoan?.id);

//     try {
//       setLoading(true);

//       // Validation
//       if (!selectedLoan) {
//         console.error("❌ No loan selected");
//         toast.error("Please select a loan");
//         return;
//       }

//       if (!data.channel) {
//         console.error("❌ No payment channel selected");
//         toast.error("Please select a payment channel");
//         return;
//       }

//       const amount = Number(data.amount);

//       if (amount <= 0 || isNaN(amount)) {
//         console.error("❌ Invalid amount:", data.amount);
//         toast.error("Please enter a valid payment amount");
//         return;
//       }

//       if (amount > selectedLoan.outstandingBalance) {
//         console.error("❌ Amount exceeds balance:", {
//           amount,
//           outstanding: selectedLoan.outstandingBalance,
//         });
//         toast.error("Payment amount exceeds outstanding balance", {
//           description: `Outstanding balance is ${formatCurrency(
//             selectedLoan.outstandingBalance
//           )}`,
//         });
//         return;
//       }

//       if (data.channel === "Mobile Money" && !data.mobileMoneyRef?.trim()) {
//         console.error("❌ Mobile Money reference missing");
//         toast.error("Mobile Money reference is required");
//         return;
//       }

//       console.log("✅ All validations passed");

//       const formData = {
//         loanId: selectedLoan.id,
//         memberId: selectedLoan.member.id,
//         amount: amount,
//         handlerUserId: currentUserId,
//         paymentMethod: data.channel,
//         transactionReference:
//           data.channel === "Mobile Money"
//             ? data.mobileMoneyRef?.trim()
//             : undefined,
//       };

//       console.log("📤 Sending request to API:", formData);

//       const response = await fetch("/api/loan-repayments", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(formData),
//       });

//       console.log("📥 Response status:", response.status);

//       let result;
//       try {
//         result = await response.json();
//         console.log("📦 Response data:", result);
//       } catch (parseError) {
//         console.error("💥 Failed to parse response:", parseError);
//         throw new Error("Invalid response from server");
//       }

//       if (!response.ok) {
//         console.error("❌ Request failed:", response.status, result);
//         throw new Error(
//           result.error || `HTTP ${response.status}: Request failed`
//         );
//       }

//       if (!result.success) {
//         console.error("❌ API returned success: false:", result);
//         throw new Error(result.error || "Failed to record payment");
//       }

//       console.log("✅ Repayment successful!");

//       toast.success("Payment Recorded Successfully!", {
//         description: `Payment of ${formatCurrency(amount)} recorded for ${
//           selectedLoan.member.user.name
//         }`,
//       });

//       // Reset and close
//       handleReset();
//       onClose();

//       // Redirect to repayment details page
//       if (result.repayment?.id) {
//         console.log(
//           "🔄 Redirecting to:",
//           `/dashboard/loan-repayments/${result.repayment.id}`
//         );
//         setTimeout(() => {
//           router.push(`/dashboard/loan-repayments/${result.repayment.id}`);
//           router.refresh();
//         }, 1000);
//       } else {
//         console.log("🔄 Refreshing page...");
//         router.refresh();
//       }
//     } catch (error) {
//       console.error("💥 Error saving repayment:", error);
//       const errorMessage =
//         error instanceof Error ? error.message : "An unexpected error occurred";
//       console.error("💥 Error message:", errorMessage);

//       toast.error("Failed to Record Payment", {
//         description: errorMessage,
//       });
//     } finally {
//       setLoading(false);
//       console.log("🏁 Form submission completed");
//     }
//   }

//   const handleReset = () => {
//     console.log("🔄 Resetting form...");
//     reset({
//       loanId: "",
//       amount: "",
//       channel: "",
//       mobileMoneyRef: "",
//     });
//     setSelectedLoan(null);
//   };

//   // Log state changes
//   useEffect(() => {
//     console.log("📊 State update:", {
//       fetchingLoans,
//       loansCount: activeLoans.length,
//       selectedLoan: selectedLoan?.id,
//       formValues: {
//         amount: watchedAmount,
//         channel: watchedChannel,
//         mobileRef: watchedMobileRef,
//       },
//     });
//   }, [
//     fetchingLoans,
//     activeLoans.length,
//     selectedLoan,
//     watchedAmount,
//     watchedChannel,
//     watchedMobileRef,
//   ]);

//   return (
//     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
//       <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
//         <DialogHeader>
//           <DialogTitle className="flex items-center gap-2 text-xl">
//             <DollarSign className="h-6 w-6 text-green-600" />
//             Record Loan Repayment
//           </DialogTitle>
//           <DialogDescription>
//             Record a loan repayment for a SACCO member. Select an active loan
//             and enter payment details.
//           </DialogDescription>
//         </DialogHeader>

//         <form onSubmit={handleSubmit(saveRepayment)} className="space-y-6">
//           {/* Loan Selection Section */}
//           <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
//             <div className="flex items-center justify-between">
//               <div className="flex items-center gap-2">
//                 <CreditCard className="h-5 w-5 text-blue-600" />
//                 <h3 className="text-lg font-semibold text-gray-900">
//                   Select Active Loan
//                 </h3>
//               </div>
//               <Button
//                 type="button"
//                 variant="outline"
//                 size="sm"
//                 onClick={loadActiveLoans}
//                 disabled={fetchingLoans}
//               >
//                 <RefreshCw
//                   className={`h-4 w-4 mr-2 ${fetchingLoans ? "animate-spin" : ""}`}
//                 />
//                 Refresh
//               </Button>
//             </div>

//             {fetchError && (
//               <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
//                 <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
//                 <div className="flex-1">
//                   <p className="font-medium text-yellow-900">
//                     Unable to load loans
//                   </p>
//                   <p className="text-sm text-yellow-700 mt-1">{fetchError}</p>
//                   <Button
//                     type="button"
//                     variant="outline"
//                     size="sm"
//                     onClick={loadActiveLoans}
//                     className="mt-2"
//                   >
//                     Try Again
//                   </Button>
//                 </div>
//               </div>
//             )}

//             {fetchingLoans ? (
//               <div className="flex items-center justify-center py-12">
//                 <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
//                 <span className="ml-3 text-gray-600">
//                   Loading active loans...
//                 </span>
//               </div>
//             ) : (
//               !fetchError && (
//                 <>
//                   <div className="space-y-2">
//                     <Label htmlFor="loan-select">Active Loan *</Label>
//                     <Popover
//                       open={loanSearchOpen}
//                       onOpenChange={setLoanSearchOpen}
//                     >
//                       <PopoverTrigger asChild>
//                         <Button
//                           type="button"
//                           variant="outline"
//                           role="combobox"
//                           aria-expanded={loanSearchOpen}
//                           className="w-full justify-between h-auto min-h-[64px] px-4 text-left"
//                           disabled={fetchingLoans || activeLoans.length === 0}
//                         >
//                           {selectedLoan ? (
//                             <div className="flex items-center gap-3 w-full py-2">
//                               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
//                                 {selectedLoan.member.user.image ? (
//                                   <img
//                                     src={selectedLoan.member.user.image}
//                                     alt={selectedLoan.member.user.name}
//                                     className="h-10 w-10 rounded-full object-cover"
//                                   />
//                                 ) : (
//                                   <User className="h-5 w-5" />
//                                 )}
//                               </div>
//                               <div className="flex flex-col items-start min-w-0 flex-1">
//                                 <span className="font-medium text-base truncate w-full">
//                                   {selectedLoan.member.user.name}
//                                 </span>
//                                 <span className="text-sm text-gray-500 truncate w-full">
//                                   {
//                                     selectedLoan.loanApplication.loanProduct
//                                       .name
//                                   }{" "}
//                                   •{" "}
//                                   {formatCurrency(
//                                     selectedLoan.outstandingBalance
//                                   )}
//                                 </span>
//                               </div>
//                             </div>
//                           ) : (
//                             <div className="flex items-center gap-2 text-gray-500">
//                               <Search className="h-4 w-4" />
//                               <span>
//                                 {activeLoans.length === 0
//                                   ? "No active loans available"
//                                   : "Search and select an active loan..."}
//                               </span>
//                             </div>
//                           )}
//                         </Button>
//                       </PopoverTrigger>
//                       <PopoverContent className="w-[800px] p-0" align="start">
//                         <Command>
//                           <CommandInput
//                             placeholder="Search by member name, number, or loan product..."
//                             className="h-12"
//                           />
//                           <CommandEmpty>No active loans found.</CommandEmpty>
//                           <CommandList>
//                             <CommandGroup className="max-h-80 overflow-y-auto">
//                               {activeLoans.map((loan) => (
//                                 <CommandItem
//                                   key={loan.id}
//                                   onSelect={() => handleLoanSelect(loan)}
//                                   className="p-4 cursor-pointer hover:bg-gray-50"
//                                 >
//                                   <div className="flex items-center gap-4 w-full">
//                                     <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
//                                       {loan.member.user.image ? (
//                                         <img
//                                           src={loan.member.user.image}
//                                           alt={loan.member.user.name}
//                                           className="h-12 w-12 rounded-full object-cover"
//                                         />
//                                       ) : (
//                                         <User className="h-6 w-6 text-gray-600" />
//                                       )}
//                                     </div>
//                                     <div className="flex-1 min-w-0">
//                                       <div className="flex items-center justify-between">
//                                         <span className="font-medium text-base truncate">
//                                           {loan.member.user.name}
//                                         </span>
//                                         <div className="flex items-center gap-2 flex-shrink-0 ml-2">
//                                           <span className="text-sm font-medium text-red-600">
//                                             {formatCurrency(
//                                               loan.outstandingBalance
//                                             )}
//                                           </span>
//                                           {isLoanOverdue(loan.dueDate) && (
//                                             <Badge
//                                               variant="destructive"
//                                               className="text-xs"
//                                             >
//                                               OVERDUE
//                                             </Badge>
//                                           )}
//                                         </div>
//                                       </div>
//                                       <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
//                                         <span className="font-mono">
//                                           #{loan.member.memberNumber}
//                                         </span>
//                                         <span>•</span>
//                                         <span className="truncate">
//                                           {
//                                             loan.loanApplication.loanProduct
//                                               .name
//                                           }
//                                         </span>
//                                         <span>•</span>
//                                         <span>
//                                           Due: {formatDate(loan.dueDate)}
//                                         </span>
//                                       </div>
//                                     </div>
//                                   </div>
//                                 </CommandItem>
//                               ))}
//                             </CommandGroup>
//                           </CommandList>
//                         </Command>
//                       </PopoverContent>
//                     </Popover>
//                   </div>

//                   {selectedLoan && (
//                     <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
//                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
//                         <div>
//                           <h4 className="font-medium text-blue-900 mb-1">
//                             Loan Details
//                           </h4>
//                           <p className="text-blue-700">
//                             {selectedLoan.loanApplication.loanProduct.name}
//                           </p>
//                           <p className="text-blue-700">
//                             Granted:{" "}
//                             {formatCurrency(selectedLoan.amountGranted)}
//                           </p>
//                         </div>
//                         <div>
//                           <h4 className="font-medium text-blue-900 mb-1">
//                             Outstanding Balance
//                           </h4>
//                           <p className="text-blue-700 text-xl font-bold">
//                             {formatCurrency(selectedLoan.outstandingBalance)}
//                           </p>
//                           <p className="text-blue-600 text-xs">
//                             Total Due:{" "}
//                             {formatCurrency(selectedLoan.totalAmountDue)}
//                           </p>
//                         </div>
//                         <div>
//                           <h4 className="font-medium text-blue-900 mb-1">
//                             Due Date
//                           </h4>
//                           <p
//                             className={
//                               isLoanOverdue(selectedLoan.dueDate)
//                                 ? "text-red-700 font-medium"
//                                 : "text-blue-700"
//                             }
//                           >
//                             {formatDate(selectedLoan.dueDate)}
//                           </p>
//                           {isLoanOverdue(selectedLoan.dueDate) && (
//                             <p className="text-red-600 text-xs font-medium">
//                               OVERDUE
//                             </p>
//                           )}
//                         </div>
//                       </div>

//                       {selectedLoan.repayments.length > 0 && (
//                         <div className="mt-3 pt-3 border-t border-blue-300">
//                           <h4 className="font-medium text-blue-900 mb-1">
//                             Last Payment
//                           </h4>
//                           <p className="text-blue-700 text-sm">
//                             {formatCurrency(selectedLoan.repayments[0].amount)}{" "}
//                             on{" "}
//                             {formatDate(
//                               selectedLoan.repayments[0].repaymentDate
//                             )}
//                           </p>
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </>
//               )
//             )}
//           </div>

//           {/* Payment Details Section */}
//           {selectedLoan && (
//             <div className="space-y-4 p-4 border rounded-lg">
//               <div className="flex items-center gap-2">
//                 <DollarSign className="h-5 w-5 text-green-600" />
//                 <h3 className="text-lg font-semibold text-gray-900">
//                   Payment Details
//                 </h3>
//               </div>

//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//                 <div className="space-y-2">
//                   <Label htmlFor="amount">Payment Amount (UGX) *</Label>
//                   <Input
//                     id="amount"
//                     type="number"
//                     step="1"
//                     min="1"
//                     placeholder="Enter payment amount"
//                     {...register("amount", {
//                       required: "Payment amount is required",
//                       min: {
//                         value: 1,
//                         message: "Amount must be greater than 0",
//                       },
//                     })}
//                     className="h-12 text-lg"
//                   />
//                   {errors.amount && (
//                     <p className="text-sm text-red-600">
//                       {errors.amount.message}
//                     </p>
//                   )}
//                 </div>

//                 <div className="space-y-2">
//                   <Label htmlFor="channel">Payment Channel *</Label>
//                   <Select
//                     value={watchedChannel}
//                     onValueChange={(value) => {
//                       console.log("🔄 Channel changed to:", value);
//                       setValue("channel", value);
//                     }}
//                   >
//                     <SelectTrigger className="h-12">
//                       <SelectValue placeholder="Select payment method" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       <SelectItem value="Mobile Money">
//                         <div className="flex items-center gap-2">
//                           <Smartphone className="h-4 w-4" />
//                           Mobile Money
//                         </div>
//                       </SelectItem>
//                       <SelectItem value="Cash">Cash</SelectItem>
//                       <SelectItem value="Bank Transfer">
//                         Bank Transfer
//                       </SelectItem>
//                       <SelectItem value="Cheque">Cheque</SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>
//                 </div>
//               </div>
// 
//               {watchedChannel === "Cash" && (
//                 <div className="space-y-2">
//                   <Label htmlFor="voucherNumber">
//                     Voucher Number *
//                   </Label>
//                   <Input
//                     id="voucherNumber"
//                     type="text"
//                     placeholder="Enter voucher/receipt number"
//                     {...register("voucherNumber", {
//                       required:
//                         watchedChannel === "Cash"
//                           ? "Voucher number is required for Cash"
//                           : false,
//                     })}
//                     className="h-12"
//                   />
//                   {errors.voucherNumber && (
//                     <p className="text-sm text-red-600">
//                       {errors.voucherNumber.message}
//                     </p>
//                   )}
//                 </div>
//               )}

//               {watchedChannel === "Mobile Money" && (
//                 <div className="space-y-2">
//                   <Label htmlFor="mobileMoneyRef">
//                     Mobile Money Reference *
//                   </Label>
//                   <Input
//                     id="mobileMoneyRef"
//                     type="text"
//                     placeholder="Enter transaction reference (e.g., MM123456)"
//                     {...register("mobileMoneyRef", {
//                       required:
//                         watchedChannel === "Mobile Money"
//                           ? "Reference is required for Mobile Money"
//                           : false,
//                     })}
//                     className="h-12"
//                   />
//                   {errors.mobileMoneyRef && (
//                     <p className="text-sm text-red-600">
//                       {errors.mobileMoneyRef.message}
//                     </p>
//                   )}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Payment Impact Preview */}
//           {getRepaymentImpact() && (
//             <div className="space-y-4 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-blue-50">
//               <div className="flex items-center gap-2">
//                 <Calculator className="h-5 w-5 text-orange-600" />
//                 <h3 className="text-lg font-semibold text-gray-900">
//                   Payment Impact
//                 </h3>
//               </div>

//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//                 <div className="space-y-1">
//                   <span className="text-sm text-gray-600">Payment Amount:</span>
//                   <p className="font-bold text-lg text-green-600">
//                     {formatCurrency(Number(watchedAmount) || 0)}
//                   </p>
//                 </div>
//                 <div className="space-y-1">
//                   <span className="text-sm text-gray-600">
//                     Current Outstanding:
//                   </span>
//                   <p className="font-bold text-lg text-red-600">
//                     {formatCurrency(selectedLoan?.outstandingBalance || 0)}
//                   </p>
//                 </div>
//                 <div className="space-y-1">
//                   <span className="text-sm text-gray-600">New Balance:</span>
//                   <p className="font-bold text-lg text-blue-600">
//                     {formatCurrency(getRepaymentImpact()!.newBalance)}
//                   </p>
//                 </div>
//                 <div className="space-y-1">
//                   <span className="text-sm text-gray-600">Progress:</span>
//                   <p className="font-bold text-lg text-purple-600">
//                     {getRepaymentImpact()!.percentagePaid.toFixed(1)}%
//                   </p>
//                 </div>
//               </div>

//               {getRepaymentImpact()!.isFullyPaid && (
//                 <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg flex items-center gap-2">
//                   <CheckCircle className="h-5 w-5 text-green-600" />
//                   <p className="text-sm text-green-800 font-medium">
//                     🎉 This payment will fully settle the loan!
//                   </p>
//                 </div>
//               )}

//               {getRepaymentImpact()!.overpayment > 0 && (
//                 <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-start gap-2">
//                   <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
//                   <div className="text-sm text-yellow-800">
//                     <p className="font-medium">⚠️ Overpayment Alert:</p>
//                     <p>
//                       Payment exceeds outstanding balance by{" "}
//                       {formatCurrency(getRepaymentImpact()!.overpayment)}
//                     </p>
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Form Actions */}
//           <div className="flex items-center justify-between pt-4 border-t">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => {
//                 handleReset();
//                 onClose();
//               }}
//               disabled={loading}
//               size="lg"
//             >
//               Cancel
//             </Button>
//             <Button
//               type="submit"
//               disabled={
//                 loading ||
//                 !selectedLoan ||
//                 !watchedChannel ||
//                 !watchedAmount ||
//                 (watchedChannel === "Mobile Money" && !watchedMobileRef)
//               }
//               size="lg"
//               className="min-w-[180px]"
//             >
//               {loading ? (
//                 <>
//                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                   Processing...
//                 </>
//               ) : (
//                 <>
//                   <CheckCircle className="mr-2 h-4 w-4" />
//                   Record Payment
//                 </>
//               )}
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }
// app/dashboard/loan-repayments/components/LoanRepaymentCreateForm.tsx
// app/dashboard/loan-repayments/components/LoanRepaymentCreateForm.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CreditCard,
  Check,
  DollarSign,
  Loader2,
  PiggyBank,
  RefreshCw,
  Search,
  Smartphone,
  User,
  Info,
  PieChart,
  Percent,
  CalendarDays,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// Define the ActiveLoan interface based on API response
interface ActiveLoan {
  id: string;
  amountGranted: number;
  totalAmountDue: number;
  outstandingBalance: number;
  amountPaid: number;
  principalPaid?: number;
  interestPaid?: number;
  penaltyPaid?: number;
  interestAmount?: number;
  interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
  interestPeriod?: "MONTHLY" | "ANNUAL";
  dueDate: string | Date;
  status: string;
  isInstitution?: boolean;
  schedules?: any[];
  member: {
    id: string;
    memberNumber: string;
    user: {
      name: string;
      email: string | null;
      phone: string | null;
      image: string | null;
    };
    accounts: Array<{
      id: string;
      accountNumber: string;
      balance: number;
      accountType: {
        name: string;
      };
      status: string;
    }>;
  };
  loanApplication: {
    loanProduct: {
      name: string;
      interestRate: number;
      interestPeriod: string;
      interestType?: "FLAT_RATE" | "REDUCING_BALANCE";
    };
  };
  branch?: {
    id: string;
    name: string;
  };
}

const formSchema = z.object({
  loanId: z.string().min(1, "Please select a loan"),
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  paymentMethod: z.string().min(1, "Please select a payment method"),
  transactionReference: z.string().optional(),
  accountId: z.string().optional(),
  interestAmount: z.coerce.number().optional(),
  penaltyAmount: z.coerce.number().optional(),
  principalAmount: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LoanRepaymentCreateFormProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  initialLoanId?: string;
  isInstitution?: boolean;
  userRole?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const isLoanOverdue = (loan: any) => {
  return loan?.status === "OVERDUE";
};

function calculatePenaltyDueForPreview(loan: any) {
  if (!isLoanOverdue(loan)) return 0;
  const outstandingBalance = Number(loan?.outstandingBalance || 0);
  const calculatedPenalty = outstandingBalance * 0.02;
  return Math.max(0, calculatedPenalty - Number(loan?.penaltyPaid || 0));
}

function getScheduleRemainingAmounts(schedule: any) {
  const paidAmount = Number(schedule?.paidAmount || 0);
  const scheduledInterest = Number(schedule?.interestPayment || 0);
  const scheduledPrincipal = Number(schedule?.principalPayment || 0);

  const paidInterest = Math.min(paidAmount, scheduledInterest);
  const paidPrincipal = Math.min(
    Math.max(0, paidAmount - paidInterest),
    scheduledPrincipal,
  );

  return {
    interestRemaining: Math.max(0, scheduledInterest - paidInterest),
    principalRemaining: Math.max(0, scheduledPrincipal - paidPrincipal),
  };
}

function getLoanScheduleBalances(loan: any) {
  const schedules = Array.isArray(loan?.schedules) ? loan.schedules : [];

  if (schedules.length === 0) {
    const principalBalance = Math.max(
      0,
      Number((loan?.amountGranted || 0) - (loan?.principalPaid || 0)),
    );
    const interestBalance = Math.max(
      0,
      Number((loan?.interestAmount || 0) - (loan?.interestPaid || 0)),
    );

    return {
      principalBalance,
      interestBalance,
      outstandingBalance:
        principalBalance + interestBalance || Number(loan?.outstandingBalance || 0),
      totalScheduledAmount: Number(loan?.totalAmountDue || 0),
    };
  }

  let principalBalance = 0;
  let interestBalance = 0;
  let totalScheduledAmount = 0;

  for (const schedule of schedules) {
    const { interestRemaining, principalRemaining } =
      getScheduleRemainingAmounts(schedule);

    interestBalance += interestRemaining;
    principalBalance += principalRemaining;
    totalScheduledAmount += Number(schedule?.totalPayment || 0);
  }

  return {
    principalBalance: Number(principalBalance.toFixed(2)),
    interestBalance: Number(interestBalance.toFixed(2)),
    outstandingBalance: Number((principalBalance + interestBalance).toFixed(2)),
    totalScheduledAmount: Number(totalScheduledAmount.toFixed(2)),
  };
}

function getRepaymentAllocationPreview(loan: any, amount: number) {
  if (!loan || !amount || amount <= 0) return null;

  const loanBalances = getLoanScheduleBalances(loan);
  const safeAmount = Math.max(0, Number(amount || 0));
  let remaining = safeAmount;

  const penaltyPortion = Math.min(remaining, calculatePenaltyDueForPreview(loan));
  remaining -= penaltyPortion;

  let interestPortion = 0;
  let principalPortion = 0;
  let fullPeriodsCovered = 0;
  let partialPeriod: number | null = null;

  const schedules = Array.isArray(loan?.schedules)
    ? [...loan.schedules]
        .filter((schedule) => schedule?.status !== "PAID")
        .sort((a, b) => Number(a?.period || 0) - Number(b?.period || 0))
    : [];

  for (const schedule of schedules) {
    if (remaining <= 0.009) break;

    const { interestRemaining, principalRemaining } =
      getScheduleRemainingAmounts(schedule);
    const totalRemaining = interestRemaining + principalRemaining;
    if (totalRemaining <= 0.009) continue;

    let usedInPeriod = 0;
    const interestApplied = Math.min(remaining, interestRemaining);
    interestPortion += interestApplied;
    remaining -= interestApplied;
    usedInPeriod += interestApplied;

    const principalApplied = Math.min(remaining, principalRemaining);
    principalPortion += principalApplied;
    remaining -= principalApplied;
    usedInPeriod += principalApplied;

    if (usedInPeriod >= totalRemaining - 0.009) {
      fullPeriodsCovered += 1;
    } else if (usedInPeriod > 0.009 && partialPeriod === null) {
      partialPeriod = Number(schedule?.period || 0);
    }
  }

  if (remaining > 0.009) {
    const extraInterest = Math.min(
      remaining,
      Math.max(0, loanBalances.interestBalance - interestPortion),
    );
    interestPortion += extraInterest;
    remaining -= extraInterest;
  }

  if (remaining > 0.009) {
    const extraPrincipal = Math.min(
      remaining,
      Math.max(0, loanBalances.principalBalance - principalPortion),
    );
    principalPortion += extraPrincipal;
    remaining -= extraPrincipal;
  }

  const newBalance = Math.max(0, loanBalances.outstandingBalance - safeAmount);
  const percentagePaid =
    loanBalances.outstandingBalance > 0
      ? Math.min(100, (safeAmount / loanBalances.outstandingBalance) * 100)
      : 100;

  return {
    newBalance,
    percentagePaid,
    isFullyPaid: newBalance <= 0.01,
    interestPortion: Number(interestPortion.toFixed(2)),
    penaltyPortion: Number(penaltyPortion.toFixed(2)),
    principalPortion: Number(principalPortion.toFixed(2)),
    monthlyInterestRate:
      Number(
        (
          (loan?.loanApplication?.loanProduct?.interestPeriod === "ANNUAL"
            ? Number(loan?.loanApplication?.loanProduct?.interestRate || 0) / 12
            : Number(loan?.loanApplication?.loanProduct?.interestRate || 0))
        ).toFixed(4),
      ) || 0,
    productInterestRate: Number(loan?.loanApplication?.loanProduct?.interestRate || 0),
    productInterestPeriod: loan?.loanApplication?.loanProduct?.interestPeriod || "ANNUAL",
    coveredInstallments: schedules.slice(0, 3).map((s) => ({
      period: s.period,
      dueDate: s.dueDate,
      totalDue: Number(s.totalPayment || 0),
      status: s.status,
    })),
    fullPeriodsCovered,
    partialPeriod,
  };
}

export default function LoanRepaymentCreateForm({
  isOpen,
  onClose,
  currentUserId,
  initialLoanId,
  isInstitution,
  userRole,
}: LoanRepaymentCreateFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<ActiveLoan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ActiveLoan | null>(null);
  const [loanSchedules, setLoanSchedules] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [fetchError, setFetchError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loanSearchOpen, setLoanSearchOpen] = useState(false);
  const [tellerFloat, setTellerFloat] = useState<number | null>(null);
  const [loadingFloat, setLoadingFloat] = useState(false);
  const [isManualAllocation, setIsManualAllocation] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loanId: "",
      amount: 0,
      paymentMethod: "",
      transactionReference: "",
      accountId: "",
      interestAmount: 0,
      penaltyAmount: 0,
      principalAmount: 0,
      notes: "",
    },
  });

  // Watch payment method to conditionally show transaction reference
  const paymentMethod = form.watch("paymentMethod");
  const amount = form.watch("amount");
  const accountId = form.watch("accountId");

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadActiveLoans().then(() => {
        if (initialLoanId) {
          handleLoanChange(initialLoanId);
        }
      });
      loadTellerFloat();
      form.reset();
      setSelectedLoan(null);
      setFetchError("");
      setSearchTerm("");
    }
  }, [isOpen, initialLoanId]);

  // Find selected account for balance checking (if Account Transfer)
  const selectedAccount = selectedLoan?.member.accounts.find(
    (acc: any) => acc.id === accountId
  );
  const selectedLoanBalances = selectedLoan
    ? getLoanScheduleBalances(selectedLoan)
    : null;

  const maxAllowed = selectedLoan ? Math.min(
    selectedLoanBalances?.outstandingBalance || selectedLoan.outstandingBalance,
    (paymentMethod === "Account Transfer" && selectedAccount) ? selectedAccount.balance : Infinity
  ) : 0;

  const handleAmountChange = (val: string) => {
    let num = parseFloat(val) || 0;
    if (num > maxAllowed) {
      num = maxAllowed;
      toast.info("Amount capped", {
        description: `Maximum allowed: ${formatCurrency(maxAllowed)}`
      });
    }
    form.setValue("amount", num, { shouldValidate: true });
  };

  const loadTellerFloat = async () => {
    try {
      setLoadingFloat(true);
      const response = await fetch("/api/v1/user-float");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.float) {
          setTellerFloat(data.float.balance);
        }
      }
    } catch (error) {
      console.error("Failed to load teller float:", error);
    } finally {
      setLoadingFloat(false);
    }
  };

  // Filter loans based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredLoans(loans);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = loans.filter((loan) => {
      const memberName = (loan.member?.user?.name || "").toLowerCase();
      const memberNumber = (loan.member?.memberNumber || "").toLowerCase();
      const productName = (loan.loanApplication?.loanProduct?.name || "").toLowerCase();
      const branchName = (loan.branch?.name || "").toLowerCase();
      const email = (loan.member?.user?.email || "").toLowerCase();
      const phone = (loan.member?.user?.phone || "").toLowerCase();
      const accounts = (loan.member?.accounts || [])
        .map((a) => (a.accountNumber || "").toLowerCase())
        .join(" ");
      const isInst = loan.isInstitution ? "institution organization" : "";

      return (
        memberName.includes(term) ||
        memberNumber.includes(term) ||
        productName.includes(term) ||
        branchName.includes(term) ||
        email.includes(term) ||
        phone.includes(term) ||
        accounts.includes(term) ||
        isInst.includes(term)
      );
    });


    setFilteredLoans(filtered);
  }, [searchTerm, loans]);

  // Fetch active loans from API
  const loadActiveLoans = async () => {
    try {
      setLoadingLoans(true);
      setFetchError("");
      console.log("🔵 Fetching active loans from /api/v1/loans/active...");

      const response = await fetch("/api/v1/loans/active", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch active loans");
      }

      const activeLoans = data.loans || [];
      setLoans(activeLoans);
      setIsManualAllocation(false); // Reset when loans reloaded
      setFilteredLoans(activeLoans);
    } catch (error) {
      console.error("❌ Error loading loans:", error);
      setFetchError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoadingLoans(false);
    }
  };

  // ... (formatCurrency, formatDate, isLoanOverdue remain same)

  // Calculate repayment impact and dynamic allocation
  // Uses the loan product's interest rate to compute monthly interest
  const getRepaymentImpact = () => {
    return getRepaymentAllocationPreview(selectedLoan, amount);
    /*
    if (!selectedLoan || !amount || amount <= 0) return null;

    const product = selectedLoan.loanApplication?.loanProduct;
    const productRate = product?.interestRate || 0;        // e.g. 30 for 30%
    const interestPeriod = product?.interestPeriod || "ANNUAL"; // "ANNUAL" or "MONTHLY"

    console.log("🧮 CALC: Starting product-aware repayment calculation", {
        amount,
        loanId: selectedLoan.id,
        outstanding: selectedLoan.outstandingBalance,
        status: selectedLoan.status,
        productRate,
        interestPeriod,
    });

    const outstandingBalance = selectedLoan.outstandingBalance;
    const newBalance = Math.max(0, outstandingBalance - amount);
    const percentagePaid = Math.min(100, (amount / outstandingBalance) * 100);
    const isFullyPaid = newBalance <= 0.01;

    let rem = amount;
    let int = 0;
    let prin = 0;
    let pen = 0;

    const now = new Date();
    const dueDate = new Date(selectedLoan.dueDate);
    const isOverdue = selectedLoan.status === "OVERDUE";

    // ─── Step 1: Penalty (2% of outstanding, ONLY if overdue) ───
    let penDue = 0;
    if (isOverdue) {
        const calculatedPenalty = outstandingBalance * 0.02;
        penDue = Math.max(0, calculatedPenalty - (selectedLoan.penaltyPaid || 0));
        console.log("⚠️ CALC: Penalty (OVERDUE)", { penDue, calculatedPenalty, alreadyPaid: selectedLoan.penaltyPaid || 0 });
    } else {
        console.log("✅ CALC: No penalty (loan not overdue)");
    }
    pen = Math.min(rem, penDue);
    rem -= pen;

    // ─── Step 2: Interest (from loan product rate) ───
    // Convert the product rate to a monthly decimal rate
    let monthlyRate: number;
    if (interestPeriod === "ANNUAL") {
        // e.g. 30% per annum → 30 / 12 / 100 = 0.025 (2.5% per month)
        monthlyRate = productRate / 12 / 100;
    } else {
        // interestPeriod === "MONTHLY" → rate is already monthly
        // e.g. 3% per month → 3 / 100 = 0.03
        monthlyRate = productRate / 100;
    }

    // Aligned with Repayment Schedule logic:
    // Priority 1: Use the exact interest amount from the next pending schedule installment
    // Priority 2: Fallback to manual calculation if schedules are missing
    const scheduledInterest = selectedLoan.schedules?.[0]?.interestPayment;
    
    let interestDue = 0;
    if (scheduledInterest !== undefined && scheduledInterest !== null) {
        interestDue = Number(scheduledInterest);
    } else {
        const interestType =
          selectedLoan.interestType ||
          selectedLoan.loanApplication.loanProduct.interestType ||
          "FLAT_RATE";
        const interestBase = interestType === "REDUCING_BALANCE" 
            ? (selectedLoan.outstandingBalance || 0) 
            : (selectedLoan.amountGranted || 0);
        interestDue = interestBase * monthlyRate;
    }

    // For the current period, the net interest due
    const netInterestDue = Math.max(0, interestDue);

    console.log("💹 CALC: Interest calculation", {
        productRate: `${productRate}%`,
        interestPeriod,
        monthlyRate: `${(monthlyRate * 100).toFixed(4)}%`,
        interestDue: interestDue.toFixed(2),
        netInterestDue: netInterestDue.toFixed(2),
    });

    int = Math.min(rem, netInterestDue);
    rem -= int;

    // ─── Step 3: Principal (everything remaining) ───
    prin = Math.max(0, rem);

    console.log("💵 CALC: Final split", {
        penalty: pen.toFixed(2),
        interest: int.toFixed(2),
        principal: prin.toFixed(2),
        total: (pen + int + prin).toFixed(2),
        matchesInput: Math.abs((pen + int + prin) - amount) < 0.01,
    });

    // Schedule context for display
    const schedules = selectedLoan.schedules || [];

    return {
      newBalance,
      percentagePaid,
      isFullyPaid,
      interestPortion: Number(int.toFixed(2)),
      penaltyPortion: Number(pen.toFixed(2)),
      principalPortion: Number(prin.toFixed(2)),
      // Extra info for display
      monthlyInterestRate: monthlyRate * 100,
      productInterestRate: productRate,
      productInterestPeriod: interestPeriod,
      coveredInstallments: schedules.map(s => ({
          period: s.period,
          dueDate: s.dueDate,
          totalDue: Number(s.totalPayment),
          status: s.status
      })).slice(0, 3)
    };
    */
  };

  // Auto-update allocation when amount or loan changes (unless manual)
  useEffect(() => {
    if (isManualAllocation) return;
    
    const impact = getRepaymentImpact();
    if (impact) {
      form.setValue("interestAmount", impact.interestPortion);
      form.setValue("penaltyAmount", impact.penaltyPortion);
      form.setValue("principalAmount", impact.principalPortion);
    } else {
      form.setValue("interestAmount", 0);
      form.setValue("penaltyAmount", 0);
      form.setValue("principalAmount", 0);
    }
  }, [amount, selectedLoan, isManualAllocation]);

  // Handle manual allocation changes (primarily for penalty)
  const handleAllocationChange = (field: "interestAmount" | "penaltyAmount" | "principalAmount", value: number) => {
    setIsManualAllocation(true);
    
    const currentAmount = form.getValues("amount") || 0;
    const currentInterest = form.getValues("interestAmount") || 0;
    const currentPenalty = form.getValues("penaltyAmount") || 0;
    
    if (field === "penaltyAmount") {
        const newPenalty = value;
        // Interest is fixed by 2.5% logic (from getRepaymentImpact or current value)
        // Principal = Total - Interest - NewPenalty
        const newPrincipal = Math.max(0, currentAmount - currentInterest - newPenalty);
        form.setValue("penaltyAmount", newPenalty);
        form.setValue("principalAmount", Number(newPrincipal.toFixed(2)));
    } else if (field === "interestAmount") {
        const newInterest = value;
        const newPrincipal = Math.max(0, currentAmount - newInterest - currentPenalty);
        form.setValue("interestAmount", newInterest);
        form.setValue("principalAmount", Number(newPrincipal.toFixed(2)));
    } else if (field === "principalAmount") {
        const newPrincipal = value;
        const newPenalty = Math.max(0, currentAmount - currentInterest - newPrincipal);
        form.setValue("principalAmount", newPrincipal);
        form.setValue("penaltyAmount", Number(newPenalty.toFixed(2)));
    }
  };

  const resetToAutoAllocation = () => {
    setIsManualAllocation(false);
  };

  const handleLoanChange = async (loanId: string) => {
    const loan = loans.find((l) => l.id === loanId);
    setSelectedLoan(loan || null);
    form.setValue("loanId", loanId);
    if (loan) {
      form.setValue("amount", getLoanScheduleBalances(loan).outstandingBalance);
    }
  };

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      console.log("🚀 Submitting loan repayment:", data);

      // Validate amount against outstanding balance
      if (
        selectedLoan &&
        data.amount > getLoanScheduleBalances(selectedLoan).outstandingBalance
      ) {
        toast.error("Invalid Amount", {
          description: "Repayment amount cannot exceed outstanding balance",
        });
        return;
      }

      // Validate Account Transfer
      if (data.paymentMethod === "Account Transfer") {
        if (!data.accountId) {
          toast.error("Please select an account for transfer");
          return;
        }

        const selectedAccount = selectedLoan?.member?.accounts?.find(
          (acc) => acc.id === data.accountId
        );

        if (selectedAccount && selectedAccount.balance < data.amount) {
          toast.error("Insufficient Funds", {
            description: `Selected account has insufficient balance (${formatCurrency(
              selectedAccount.balance
            )})`,
          });
          return;
        }
      }

      // Validate Mobile Money reference
      if (
        data.paymentMethod === "Mobile Money" &&
        !data.transactionReference?.trim()
      ) {
        toast.error("Mobile Money reference is required");
        return;
      }



      // Prepare request payload
      const payload = {
        loanId: data.loanId,
        memberId: selectedLoan!.member.id,
        amount: data.amount,
        handlerUserId: currentUserId,
        paymentMethod: data.paymentMethod,
        transactionReference: data.transactionReference?.trim() || undefined,
        accountId: data.paymentMethod === "Account Transfer" ? data.accountId : undefined,
        interestAmount: data.interestAmount,
        penaltyAmount: data.penaltyAmount,
        principalAmount: data.principalAmount,
        notes: data.notes?.trim() || undefined,
      };

      console.log("📤 Sending request to /api/v1/loan-repayments:", payload);

      const response = await fetch("/api/v1/loan-repayments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 Response status:", response.status);

      const result = await response.json();
      console.log("📦 Response data:", result);

      if (!response.ok) {
        throw new Error(result.error || "Failed to process repayment");
      }

      if (!result.success) {
        throw new Error(result.error || "Failed to record payment");
      }

      console.log("✅ Repayment successful!");

      toast.success("Payment Recorded Successfully!", {
        description: `Payment of ${formatCurrency(data.amount)} recorded for ${selectedLoan!.isInstitution ? selectedLoan!.member.user.name : selectedLoan!.member.user.name}`,
      });

      // Reset form and close dialog
      form.reset();
      setSelectedLoan(null);
      setSearchTerm("");
      onClose();

      // Redirect to repayment details or refresh
      if (result.repayment?.id) {
        console.log(
          "🔄 Redirecting to:",
          `/dashboard/loan-repayments/${result.repayment.id}`
        );
        setTimeout(() => {
          router.push(`/dashboard/loan-repayments/${result.repayment.id}`);
          router.refresh();
        }, 1000);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("❌ Error creating loan repayment:", error);
      toast.error("Failed to Record Payment", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Process Loan Repayment
            {tellerFloat !== null && (
              <Badge variant="outline" className="ml-auto bg-green-50 text-green-700 border-green-200">
                Your Float: {formatCurrency(tellerFloat)}
              </Badge>
            )}
            {loadingFloat && <Loader2 className="ml-auto h-4 w-4 animate-spin text-gray-400" />}
          </DialogTitle>
          <DialogDescription>
            Select a loan and enter the repayment details
            {loans.length > 0 && (
              <span className="ml-2 font-medium text-blue-600">
                ({filteredLoans.length} of {loans.length} loans)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Error State */}
        {fetchError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-yellow-900">
                Unable to load loans
              </p>
              <p className="text-sm text-yellow-700 mt-1">{fetchError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadActiveLoans}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loadingLoans && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading active loans...</span>
          </div>
        )}

        {/* Form */}
        {!loadingLoans && !fetchError && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Loan Selection - Integrated Search Dropdown */}
              <FormField
                control={form.control}
                name="loanId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Select Loan *</FormLabel>
                    <Popover
                      open={loanSearchOpen}
                      onOpenChange={setLoanSearchOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={loanSearchOpen}
                            className={cn(
                              "w-full justify-between h-auto min-h-[64px] px-4 text-left font-normal border-gray-200 hover:border-blue-300 transition-colors",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={loadingLoans || loans.length === 0}
                          >
                            {field.value ? (
                              <div className="flex items-center gap-3 py-1 overflow-hidden">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
                                  {selectedLoan?.member?.user?.image ? (
                                    <img
                                      src={selectedLoan.member.user.image}
                                      alt={selectedLoan.member.user.name}
                                      className="h-10 w-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-5 w-5" />
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0 pr-4">
                                  <span className="font-semibold text-sm text-gray-900 truncate">
                                    {selectedLoan?.member?.user?.name}
                                  </span>
                                  <span className="text-xs text-gray-500 truncate mt-0.5">
                                    {selectedLoan?.member?.memberNumber} • {selectedLoan?.loanApplication?.loanProduct?.name}
                                  </span>
                                  <span className="text-xs font-bold text-red-600 mt-1">
                                    Outstanding: {formatCurrency(selectedLoan?.outstandingBalance || 0)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 text-gray-500 py-2">
                                <Search className="h-4 w-4" />
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">Select a loan...</span>
                                  <span className="text-xs">Search by member name, number or institution</span>
                                </div>
                              </div>
                            )}
                            <RefreshCw className={cn("ml-2 h-4 w-4 shrink-0 opacity-40 transition-transform", loadingLoans && "animate-spin")} />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command className="w-full">
                          <CommandInput
                            placeholder="Search name, member #, phone, or institution..."
                            className="h-12 border-none focus:ring-0"
                            onValueChange={(val) => setSearchTerm(val)}
                          />
                          <CommandEmpty className="py-6 text-center text-sm text-gray-500">
                            No matching loans found.
                          </CommandEmpty>
                          <CommandList className="max-h-[350px] overflow-y-auto">
                            <CommandGroup heading="Active Loans">
                              {filteredLoans.map((loan) => (
                                <CommandItem
                                  key={loan.id}
                                  value={`${loan.member.user.name} ${loan.member.memberNumber} ${loan.loanApplication.loanProduct.name} ${loan.isInstitution ? "institution organization" : "member"}`}
                                  onSelect={() => {
                                    handleLoanChange(loan.id);
                                    setLoanSearchOpen(false);
                                  }}
                                  className="p-3 cursor-pointer aria-selected:bg-blue-50"
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-50 border border-gray-100 flex-shrink-0">
                                      {loan.member.user.image ? (
                                        <img
                                          src={loan.member.user.image}
                                          alt={loan.member.user.name}
                                          className="h-11 w-11 rounded-full object-cover"
                                        />
                                      ) : (
                                        <User className="h-5 w-5 text-gray-500" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <p className="font-semibold text-sm text-gray-900 truncate">
                                          {loan.member.user.name}
                                          {loan.isInstitution && (
                                            <Badge variant="secondary" className="ml-1.5 text-[9px] h-3.5 bg-blue-50 text-blue-700 border-blue-100">Inst.</Badge>
                                          )}
                                        </p>
                                        <span className={cn(
                                          "text-xs font-bold",
                                          loan.status === "OVERDUE" ? "text-red-600" : "text-gray-900"
                                        )}>
                                          {formatCurrency(loan.outstandingBalance)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] font-mono text-gray-500">
                                          {loan.member.memberNumber}
                                        </span>
                                        <span className="text-gray-300">•</span>
                                        <span className="text-[11px] text-gray-500 truncate">
                                          {loan.loanApplication.loanProduct.name}
                                        </span>
                                      </div>
                                    </div>
                                    <Check
                                      className={cn(
                                        "ml-auto h-4 w-4 text-blue-600",
                                        field.value === loan.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
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

              {/* Selected Loan Details */}
              {selectedLoan && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        {selectedLoan.isInstitution ? (
                          <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                        ) : (
                          <User className="h-5 w-5 text-blue-600 mt-0.5" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedLoan.isInstitution ? "Institution" : "Member"}
                          </p>
                          <p className="text-base font-semibold">
                            {selectedLoan.member.user.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {selectedLoan.isInstitution ? "" : `#${selectedLoan.member.memberNumber}`}
                          </p>
                          {selectedLoan.member.user.phone && (
                            <p className="text-xs text-gray-500">
                              {selectedLoan.member.user.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Loan Product
                          </p>
                          <p className="text-base font-semibold">
                            {selectedLoan.loanApplication.loanProduct.name}
                          </p>
                          <Badge variant="outline">{selectedLoan.status}</Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Outstanding Balance
                          </p>
                          <p className="text-lg font-bold text-red-700">
                            {formatCurrency(selectedLoanBalances?.outstandingBalance || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <PieChart className="h-5 w-5 text-orange-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Interest Balance
                          </p>
                          <p className="text-lg font-bold text-orange-700">
                            {formatCurrency(selectedLoanBalances?.interestBalance || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Principal Balance
                          </p>
                          <p className="text-lg font-bold text-blue-700">
                            {formatCurrency(selectedLoanBalances?.principalBalance || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <DollarSign className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Amount Paid
                          </p>
                          <p className="text-lg font-bold text-green-700">
                            {formatCurrency(selectedLoan.amountPaid)}
                          </p>
                        </div>
                      </div>

                      {selectedLoan.branch && (
                        <div className="flex items-start gap-3">
                          <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              Branch
                            </p>
                            <p className="text-base font-semibold">
                              {selectedLoan.branch.name}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Percent className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            Interest Rate
                          </p>
                          <p className="text-base font-semibold">
                            {selectedLoan.loanApplication.loanProduct.interestRate}% ({selectedLoan.loanApplication.loanProduct.interestPeriod})
                          </p>
                        </div>
                      </div>
                    </div>

                    {isLoanOverdue(selectedLoan) && (
                      <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          This loan is overdue (Due:{" "}
                          {formatDate(selectedLoan.dueDate)})
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Repayment Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Amount (UGX) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Enter amount"
                        {...field}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        disabled={!selectedLoan}
                        max={maxAllowed}
                      />
                    </FormControl>
                    <div className="flex justify-between text-[10px] text-muted-foreground italic mt-1">
                      <span>Max Loan Balance: {selectedLoan ? formatCurrency(selectedLoanBalances?.outstandingBalance || selectedLoan.outstandingBalance) : "N/A"}</span>
                      <span className={field.value >= maxAllowed ? "text-orange-600 font-bold" : ""}>
                        Limit: {formatCurrency(maxAllowed)}
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Repayment Allocation Breakdown */}
              {selectedLoan && amount > 0 && (
                <div className="space-y-4 border rounded-xl p-6 bg-slate-50/50 border-slate-200 mt-6">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-blue-600" />
                      <h4 className="font-bold text-base text-slate-800 tracking-tight">Repayment Allocation Breakdown</h4>
                    </div>
                    {isManualAllocation && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        onClick={resetToAutoAllocation}
                        className="text-blue-600 hover:text-blue-700 text-xs h-7 px-2 hover:bg-blue-50"
                      >
                        <Filter className="h-3 w-3 mr-1" />
                        Auto-allocate
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Interest Card */}
                    <FormField
                      control={form.control}
                      name="interestAmount"
                      render={({ field }) => (
                        <FormItem className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-400" />
                          <FormLabel className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2 flex justify-between items-center">
                            <span>Interest Income</span>
                            {getRepaymentImpact()?.monthlyInterestRate !== undefined && (
                              <span className="text-[9px] text-orange-500 lowercase normal-case font-medium italic">
                                ({getRepaymentImpact()?.monthlyInterestRate.toFixed(1)}% monthly)
                              </span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-none p-0 h-9 text-2xl font-bold text-orange-600 focus-visible:ring-0 bg-transparent w-full cursor-not-allowed"
                              {...field}
                              readOnly
                              disabled
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    {/* Penalty Card */}
                    <FormField
                      control={form.control}
                      name="penaltyAmount"
                      render={({ field }) => (
                        <FormItem className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500" />
                          <FormLabel className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2">Penalty Income</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-none p-0 h-9 text-2xl font-bold text-red-600 focus-visible:ring-0 bg-transparent w-full"
                              {...field}
                              onChange={(e) => handleAllocationChange("penaltyAmount", parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Principal Card */}
                    <FormField
                      control={form.control}
                      name="principalAmount"
                      render={({ field }) => (
                        <FormItem className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden group">
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                          <FormLabel className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 block pl-2">Principal Paid</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-none p-0 h-9 text-2xl font-bold text-blue-600 focus-visible:ring-0 bg-transparent w-full cursor-not-allowed"
                              {...field}
                              readOnly
                              disabled
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Borrowed idea from schedule: Show next installments */}
                  <div className="mt-4 border-t pt-3">
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <CalendarDays className="h-3 w-3" />
                        Schedule Context (Next Installments)
                    </h5>
                    {(getRepaymentImpact()?.fullPeriodsCovered || getRepaymentImpact()?.partialPeriod) && (
                      <div className="mb-2 text-[12px] font-semibold text-blue-700">
                        {getRepaymentImpact()?.fullPeriodsCovered
                          ? `Covers ${getRepaymentImpact()?.fullPeriodsCovered} full repayment period${getRepaymentImpact()?.fullPeriodsCovered === 1 ? "" : "s"}`
                          : "No full repayment period covered yet"}
                        {getRepaymentImpact()?.partialPeriod
                          ? ` and part of period ${getRepaymentImpact()?.partialPeriod}`
                          : ""}
                      </div>
                    )}
                    <div className="overflow-hidden border rounded-md bg-white">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-100 text-slate-600 font-semibold">
                                <tr>
                                    <th className="px-3 py-1.5">Inst #</th>
                                    <th className="px-3 py-1.5">Due Date</th>
                                    <th className="px-3 py-1.5 text-right">Total Due</th>
                                    <th className="px-3 py-1.5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {getRepaymentImpact()?.coveredInstallments.map((inst: any) => (
                                    <tr key={inst.period} className="hover:bg-slate-50">
                                        <td className="px-3 py-1.5 font-medium">{inst.period}</td>
                                        <td className="px-3 py-1.5">{formatDate(inst.dueDate)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold">{formatCurrency(inst.totalDue)}</td>
                                        <td className="px-3 py-1.5 text-right">
                                            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                                inst.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {inst.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1.5 bg-blue-50/50 p-2 rounded text-blue-700 mt-2 italic">
                    <Info className="h-4 w-4 flex-shrink-0" />
                    These values are autogenerated based on your official loan repayment schedule.
                  </p>
                </div>
              )}

              {/* Payment Method */}
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedLoan}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userRole !== "AGENT" && userRole !== "TELLER" && (
                          <SelectItem value="Mobile Money">
                            <div className="flex items-center gap-2">
                              <Smartphone className="h-4 w-4" />
                              Mobile Money
                            </div>
                          </SelectItem>
                        )}
                        {userRole !== "AGENT" && userRole !== "TELLER" && (
                          <SelectItem value="Account Transfer">
                            <div className="flex items-center gap-2">
                              <PiggyBank className="h-4 w-4" />
                              Account Transfer
                            </div>
                          </SelectItem>
                        )}
                        <SelectItem value="Cash">Cash</SelectItem>
                        {userRole !== "AGENT" && userRole !== "TELLER" && (
                          <>
                            <SelectItem value="Bank Transfer">
                              Bank Transfer
                            </SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Account Selection (for Account Transfer) */}
              {paymentMethod === "Account Transfer" && (
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Source Account *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account to deduct from" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {selectedLoan?.member?.accounts?.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id}
                              disabled={account.balance < amount}
                              className="py-3"
                            >
                              <div className="flex flex-col w-full gap-1">
                                <div className="flex justify-between items-center w-full min-w-[200px] gap-4">
                                  <span>{account.accountType.name}</span>
                                  <span
                                    className={
                                      account.balance < amount
                                        ? "text-red-500 font-medium"
                                        : "text-green-600 font-medium"
                                    }
                                  >
                                    {formatCurrency(account.balance)}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {account.accountNumber}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Transaction Reference (for Mobile Money) */}
              {paymentMethod === "Mobile Money" && (
                <FormField
                  control={form.control}
                  name="transactionReference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile Money Reference *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter transaction reference (e.g., MM123456)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}



              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes"
                        {...field}
                        disabled={!selectedLoan}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Impact Preview */}
              {getRepaymentImpact() && (
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Payment Impact
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Payment Amount</p>
                        <p className="text-lg font-bold text-green-600">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">New Balance</p>
                        <p className="text-lg font-bold text-blue-600">
                          {formatCurrency(getRepaymentImpact()!.newBalance)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Progress</p>
                        <p className="text-lg font-bold text-purple-600">
                          {getRepaymentImpact()!.percentagePaid.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    {getRepaymentImpact()!.isFullyPaid && (
                      <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                        <p className="text-sm text-green-800 font-medium">
                          🎉 This payment will fully settle the loan!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !selectedLoan}
                  className="min-w-[160px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="mr-2 h-4 w-4" />
                      Process Repayment
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
