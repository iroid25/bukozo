// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Card,
//   CardContent,
//   CardHeader,
//   CardTitle,
//   CardDescription,
// } from "@/components/ui/card";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Badge } from "@/components/ui/badge";

// import { Separator } from "@/components/ui/separator";
// import {
//   Phone,
//   Mail,
//   Clock,
//   Shield,
//   AlertTriangle,
//   CheckCircle,
//   RefreshCw,
//   Loader2,
// } from "lucide-react";
// import {
//   initiateWithdrawal,
//   verifyAndCompleteWithdrawal,
//   resendVerificationCode,
// } from "@/actions/withdrawals";

// interface Account {
//   id: string;
//   accountNumber: string;
//   balance: number;
//   accountType: {
//     name: string;
//     minBalance: number;
//   };
//   branch: {
//     name: string;
//     location: string;
//   };
// }

// interface Member {
//   id: string;
//   memberNumber: string;
//   user: {
//     name: string;
//     email: string;
//     phone: string;
//     image?: string;
//   };
//   accounts: Account[];
// }

// interface WithdrawalFormProps {
//   member: Member;
//   handlerUserId: string;
//   onSuccess?: () => void;
// }

// interface VerificationStep {
//   verificationId: string;
//   transactionRef: string;
//   memberName: string;
//   amount: number;
//   expiresAt: Date;
//   notificationsSent: Array<{ type: string; success: boolean }>;
// }

// export function WithdrawalForm({
//   member,
//   handlerUserId,
//   onSuccess,
// }: WithdrawalFormProps) {
//   const router = useRouter();
//   const [step, setStep] = useState<"form" | "verification">("form");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null);

//   // Form state
//   const [formData, setFormData] = useState({
//     accountId: "",
//     amount: "",
//     channel: "",
//     mobileMoneyRef: "",
//     description: "",
//   });

//   // Verification state
//   const [verificationData, setVerificationData] =
//     useState<VerificationStep | null>(null);
//   const [verificationCode, setVerificationCode] = useState("");
//   const [timeRemaining, setTimeRemaining] = useState<number>(0);
//   const [canResend, setCanResend] = useState(false);

//   // Selected account for balance checking
//   const selectedAccount = member.accounts.find(
//     (acc) => acc.id === formData.accountId
//   );

//   // Timer for verification expiry
//   useEffect(() => {
//     let interval: NodeJS.Timeout;

//     if (verificationData && step === "verification") {
//       const updateTimer = () => {
//         const now = new Date().getTime();
//         const expiry = new Date(verificationData.expiresAt).getTime();
//         const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

//         setTimeRemaining(remaining);
//         setCanResend(remaining < 300); // Allow resend in last 5 minutes

//         if (remaining === 0) {
//           setError("Verification code has expired. Please start over.");
//         }
//       };

//       updateTimer();
//       interval = setInterval(updateTimer, 1000);
//     }

//     return () => {
//       if (interval) clearInterval(interval);
//     };
//   }, [verificationData, step]);

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = seconds % 60;
//     return `${mins}:${secs.toString().padStart(2, "0")}`;
//   };

//   const handleInitiateWithdrawal = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     try {
//       const result = await initiateWithdrawal(
//         {
//           memberId: member.id,
//           accountId: formData.accountId,
//           amount: parseFloat(formData.amount),
//           channel: formData.channel,
//           mobileMoneyRef: formData.mobileMoneyRef || undefined,
//           description: formData.description || undefined,
//         },
//         handlerUserId
//       );

//       if (result.error) {
//         setError(result.error);
//       } else if (result.data) {
//         setVerificationData(result.data);
//         setStep("verification");
//         setSuccess("Verification code sent successfully!");
//       }
//     } catch (error) {
//       setError("An unexpected error occurred. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyCode = async () => {
//     if (!verificationData || !verificationCode.trim()) {
//       setError("Please enter the verification code.");
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     try {
//       const result = await verifyAndCompleteWithdrawal(
//         verificationData.verificationId,
//         verificationCode.trim(),
//         handlerUserId
//       );

//       if (result.error) {
//         setError(result.error);
//       } else if (result.data) {
//         setSuccess("Withdrawal completed successfully!");
//         setStep("form");
//         setVerificationData(null);
//         setVerificationCode("");
//         setFormData({
//           accountId: "",
//           amount: "",
//           channel: "",
//           mobileMoneyRef: "",
//           description: "",
//         });

//         if (onSuccess) {
//           onSuccess();
//         }

//         // Refresh the page to show updated data
//         router.refresh();
//       }
//     } catch (error) {
//       setError("An unexpected error occurred. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResendCode = async () => {
//     if (!verificationData) return;

//     setLoading(true);
//     setError(null);

//     try {
//       const result = await resendVerificationCode(
//         verificationData.verificationId
//       );

//       if (result.error) {
//         setError(result.error);
//       } else if (result.data) {
//         setSuccess("New verification code sent!");
//         setCanResend(false);
//       }
//     } catch (error) {
//       setError("Failed to resend verification code. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const resetForm = () => {
//     setStep("form");
//     setVerificationData(null);
//     setVerificationCode("");
//     setError(null);
//     setSuccess(null);
//   };

//   if (step === "verification" && verificationData) {
//     return (
//       <Card className="w-full max-w-md mx-auto">
//         <CardHeader className="text-center">
//           <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
//             <Shield className="w-6 h-6 text-blue-600" />
//           </div>
//           <CardTitle>Verify Withdrawal</CardTitle>
//           <CardDescription>
//             Enter the verification code sent to your registered contact
//             information
//           </CardDescription>
//         </CardHeader>

//         <CardContent className="space-y-6">
//           {/* Withdrawal Summary */}
//           <div className="bg-gray-50 p-4 rounded-lg">
//             <h3 className="font-semibold mb-2">Withdrawal Details</h3>
//             <div className="space-y-1 text-sm">
//               <div className="flex justify-between">
//                 <span>Reference:</span>
//                 <span className="font-mono">
//                   {verificationData.transactionRef}
//                 </span>
//               </div>
//               <div className="flex justify-between">
//                 <span>Amount:</span>
//                 <span className="font-bold text-red-600">
//                   UGX {verificationData.amount.toLocaleString()}
//                 </span>
//               </div>
//               <div className="flex justify-between">
//                 <span>Member:</span>
//                 <span>{verificationData.memberName}</span>
//               </div>
//             </div>
//           </div>

//           {/* Notification Status */}
//           <div className="space-y-2">
//             <Label className="text-sm font-medium">Notifications Sent:</Label>
//             <div className="flex gap-2">
//               {verificationData.notificationsSent.map((notification, index) => (
//                 <Badge
//                   key={index}
//                   variant={notification.success ? "default" : "destructive"}
//                   className="flex items-center gap-1"
//                 >
//                   {notification.type === "SMS" ? (
//                     <Phone className="w-3 h-3" />
//                   ) : (
//                     <Mail className="w-3 h-3" />
//                   )}
//                   {notification.type}
//                   {notification.success ? (
//                     <CheckCircle className="w-3 h-3" />
//                   ) : (
//                     <AlertTriangle className="w-3 h-3" />
//                   )}
//                 </Badge>
//               ))}
//             </div>
//           </div>

//           {/* Timer */}
//           <div className="flex items-center gap-2 text-sm">
//             <Clock className="w-4 h-4" />
//             <span>Code expires in: </span>
//             <Badge variant="outline" className="font-mono">
//               {formatTime(timeRemaining)}
//             </Badge>
//           </div>

//           {/* Verification Input */}
//           <div className="space-y-2">
//             <Label htmlFor="verification-code">Verification Code</Label>
//             <Input
//               id="verification-code"
//               type="text"
//               placeholder="Enter 6-digit code"
//               value={verificationCode}
//               onChange={(e) =>
//                 setVerificationCode(
//                   e.target.value.replace(/\D/g, "").slice(0, 6)
//                 )
//               }
//               maxLength={6}
//               className="text-center text-lg font-mono tracking-widest"
//             />
//           </div>

//           {/* Error/Success Messages */}
//           {error && (
//             <Alert variant="destructive">
//               <AlertTriangle className="h-4 w-4" />
//               <AlertDescription>{error}</AlertDescription>
//             </Alert>
//           )}

//           {success && (
//             <Alert>
//               <CheckCircle className="h-4 w-4" />
//               <AlertDescription>{success}</AlertDescription>
//             </Alert>
//           )}

//           {/* Action Buttons */}
//           <div className="flex gap-2">
//             <Button
//               onClick={handleVerifyCode}
//               disabled={
//                 loading || verificationCode.length !== 6 || timeRemaining === 0
//               }
//               className="flex-1"
//             >
//               {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
//               Verify & Complete
//             </Button>

//             <Button
//               variant="outline"
//               onClick={handleResendCode}
//               disabled={loading || !canResend || timeRemaining === 0}
//               className="px-3"
//             >
//               <RefreshCw className="w-4 h-4" />
//             </Button>
//           </div>

//           <div className="text-center">
//             <Button variant="ghost" onClick={resetForm} className="text-sm">
//               Cancel Withdrawal
//             </Button>
//           </div>
//         </CardContent>
//       </Card>
//     );
//   }

//   return (
//     <Card className="w-full max-w-2xl mx-auto">
//       <CardHeader>
//         <CardTitle>Process Withdrawal</CardTitle>
//         <CardDescription>
//           Create a new withdrawal for {member.user.name} (Member:{" "}
//           {member.memberNumber})
//         </CardDescription>
//       </CardHeader>

//       <CardContent>
//         <form onSubmit={handleInitiateWithdrawal} className="space-y-6">
//           {/* Account Selection */}
//           <div className="space-y-2">
//             <Label htmlFor="account">Account</Label>
//             <Select
//               value={formData.accountId}
//               onValueChange={(value) =>
//                 setFormData({ ...formData, accountId: value })
//               }
//             >
//               <SelectTrigger>
//                 <SelectValue placeholder="Select account" />
//               </SelectTrigger>
//               <SelectContent>
//                 {member.accounts.map((account) => (
//                   <SelectItem key={account.id} value={account.id}>
//                     <div className="flex flex-col">
//                       <span>{account.accountNumber}</span>
//                       <span className="text-sm text-muted-foreground">
//                         {account.accountType.name.replace(/_/g, " ")} - Balance:
//                         UGX {account.balance.toLocaleString()}
//                       </span>
//                     </div>
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           </div>

//           {/* Account Balance Info */}
//           {selectedAccount && (
//             <div className="bg-blue-50 p-4 rounded-lg">
//               <div className="grid grid-cols-2 gap-4 text-sm">
//                 <div>
//                   <Label className="text-muted-foreground">
//                     Current Balance
//                   </Label>
//                   <p className="font-semibold">
//                     UGX {selectedAccount.balance.toLocaleString()}
//                   </p>
//                 </div>
//                 <div>
//                   <Label className="text-muted-foreground">
//                     Minimum Balance
//                   </Label>
//                   <p className="font-semibold">
//                     UGX{" "}
//                     {selectedAccount.accountType.minBalance.toLocaleString()}
//                   </p>
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* Amount */}
//           <div className="space-y-2">
//             <Label htmlFor="amount">Withdrawal Amount (UGX)</Label>
//             <Input
//               id="amount"
//               type="number"
//               step="0.01"
//               min="0"
//               placeholder="0.00"
//               value={formData.amount}
//               onChange={(e) =>
//                 setFormData({ ...formData, amount: e.target.value })
//               }
//               required
//             />
//             {selectedAccount && formData.amount && (
//               <div className="text-sm text-muted-foreground">
//                 Available after withdrawal: UGX{" "}
//                 {(
//                   selectedAccount.balance - parseFloat(formData.amount || "0")
//                 ).toLocaleString()}
//               </div>
//             )}
//           </div>

//           {/* Channel */}
//           <div className="space-y-2">
//             <Label htmlFor="channel">Withdrawal Channel</Label>
//             <Select
//               value={formData.channel}
//               onValueChange={(value) =>
//                 setFormData({ ...formData, channel: value })
//               }
//             >
//               <SelectTrigger>
//                 <SelectValue placeholder="Select channel" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="Cash">Cash</SelectItem>
//                 <SelectItem value="Mobile Money">Mobile Money</SelectItem>
//                 <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>

//           {/* Mobile Money Reference */}
//           {formData.channel === "Mobile Money" && (
//             <div className="space-y-2">
//               <Label htmlFor="mobile-money-ref">Mobile Money Reference</Label>
//               <Input
//                 id="mobile-money-ref"
//                 type="text"
//                 placeholder="Enter mobile money reference"
//                 value={formData.mobileMoneyRef}
//                 onChange={(e) =>
//                   setFormData({ ...formData, mobileMoneyRef: e.target.value })
//                 }
//                 required
//               />
//             </div>
//           )}

//           {/* Description */}
//           <div className="space-y-2">
//             <Label htmlFor="description">Description (Optional)</Label>
//             <Textarea
//               id="description"
//               placeholder="Enter withdrawal description"
//               value={formData.description}
//               onChange={(e) =>
//                 setFormData({ ...formData, description: e.target.value })
//               }
//               rows={3}
//             />
//           </div>

//           <Separator />

//           {/* Verification Notice */}
//           <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
//             <div className="flex items-start gap-3">
//               <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
//               <div>
//                 <h3 className="font-semibold text-amber-800">
//                   Security Verification Required
//                 </h3>
//                 <p className="text-sm text-amber-700 mt-1">
//                   A verification code will be sent to the member's registered
//                   phone number ({member.user.phone}) and email (
//                   {member.user.email}) to complete this withdrawal.
//                 </p>
//               </div>
//             </div>
//           </div>

//           {/* Error/Success Messages */}
//           {error && (
//             <Alert variant="destructive">
//               <AlertTriangle className="h-4 w-4" />
//               <AlertDescription>{error}</AlertDescription>
//             </Alert>
//           )}

//           {success && (
//             <Alert>
//               <CheckCircle className="h-4 w-4" />
//               <AlertDescription>{success}</AlertDescription>
//             </Alert>
//           )}

//           {/* Submit Button */}
//           <Button
//             type="submit"
//             disabled={
//               loading ||
//               !formData.accountId ||
//               !formData.amount ||
//               !formData.channel
//             }
//             className="w-full"
//             size="lg"
//           >
//             {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
//             Send Verification Code
//           </Button>
//         </form>
//       </CardContent>
//     </Card>
//   );
// }
