// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  Upload,
  AlertCircle,
  FileCheck,
  Download,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
  FileText,
  Info,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileUploader } from "./FileUploader";
import { useUploadThing } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";

interface BulkMigrationProps {
  members: { id: string; name: string; memberNumber: string }[];
  products: { id: string; name: string; interestRate: number; maxAmount: number }[];
  officers?: { id: string; name: string }[];
  onSuccess?: () => void;
}

interface ParsedRow {
  rowNum: number;
  memberNumber: string;
  productName: string;
  amountGranted: number;
  outstandingBalance: number;
  dateDisbursed: string | number | Date;
  period: number;
  rate?: number;
  notes?: string;
  status: "VALID" | "ERROR";
  errorMsg?: string;
  memberId?: string;
  productId?: string;
  parsedDate?: Date;
}

export function BulkMigration({ members, products, officers = [], onSuccess }: BulkMigrationProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [auditLog, setAuditLog] = useState<{row: number, success: boolean, msg: string}[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  
  // Data fetching states
  const [internalMembers, setInternalMembers] = useState(members);
  const [internalProducts, setInternalProducts] = useState(products);
  const [internalOfficers, setInternalOfficers] = useState(officers);
  const [loadingData, setLoadingData] = useState(false);

  const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
  const [openOfficerCombo, setOpenOfficerCombo] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [openProductCombo, setOpenProductCombo] = useState(false);

  // Fetch data if props are empty
  useEffect(() => {
    const fetchRequiredData = async () => {
        if (internalMembers.length > 0 && internalProducts.length > 0) return;
        
        setLoadingData(true);
        try {
            const [mRes, pRes, oRes] = await Promise.all([
                fetch("/api/v1/members"),
                fetch("/api/v1/loans/products"),
                fetch("/api/v1/users")
            ]);

            const mData = await mRes.json();
            const pData = await pRes.json();
            const oData = await oRes.json();

            if (mData.data) setInternalMembers(mData.data.map((m: any) => ({
                id: m.id,
                name: m.user?.name || "Unknown",
                memberNumber: m.memberNumber
            })));
            
            if (Array.isArray(pData)) setInternalProducts(pData);
            
            if (oData.success && Array.isArray(oData.data)) {
                const staffRoles = ["ADMIN", "BRANCHMANAGER", "LOANOFFICER", "ACCOUNTANT"];
                setInternalOfficers(oData.data
                    .filter((u: any) => staffRoles.includes(u.role) && u.isActive)
                    .map((u: any) => ({ id: u.id, name: u.name }))
                );
            }
        } catch (err) {
            console.error("Failed to fetch migration data", err);
            toast.error("Failed to load required data for migration");
        } finally {
            setLoadingData(false);
        }
    };

    fetchRequiredData();
  }, []);

  // Use internal state instead of props
  const currentMembers = internalMembers;
  const currentProducts = internalProducts;
  const currentOfficers = internalOfficers;

  const { startUpload } = useUploadThing("migrationFile", {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        console.log("Upload completed:", res[0].url);
        setUploadedUrl(res[0].url);
        toast.success("File uploaded to secure storage.");
      }
    },
    onUploadError: (error: Error) => {
      console.error("Upload failed:", error);
      toast.error(`Upload failed: ${error.message}`);
    },
    onUploadProgress: (p) => {
        setUploadProgress(p);
    },
  });


  // Helpers for validation lookup
  const memberMap = useMemo(() => new Map(currentMembers.map(m => [m.memberNumber.toUpperCase(), m])), [currentMembers]);
  const productMap = useMemo(() => new Map(currentProducts.map(p => [p.name.toUpperCase(), p])), [currentProducts]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setParsedRows([]);
    setAuditLog([]);
    setUploadProgress(0);
    setUploadedUrl(null);
  };

  const processSelectedFile = async () => {
    if (!file) {
      toast.error("No file selected");
      return;
    }

    setLoading(true);
    setError(null);
    setUploadProgress(0);
    setAuditLog([]); // Clear old logs
    setParsedRows([]); // Clear old data
    
    // 1. Start Upload to UploadThing concurrently
    try {
        startUpload([file]);
    } catch(e) {
        console.error("Upload start failed", e);
        // Continue parsing even if upload fails initial check
    }

    // 2. Start Parsing with a small delay for UI to update
    // Using a promise-based delay instead of nested setTimeout for cleaner async flow
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        


        if (isPdf) {
            console.log("Starting PDF parsing for:", file.name);
            
            // Use API route to parse PDF
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/loans/parse-pdf', {
                method: 'POST',
                body: formData,
            });
            
            const result = await response.json();
            
            if (!result.success || !result.data) {
               throw new Error(result.error || "Failed to parse PDF");
            }
            
            const pdfData = result.data;
            console.log("PDF Data extracted:", pdfData?.length);
            
            if (!pdfData || pdfData.length === 0) {
              throw new Error("No valid loan data found in PDF. Please check the file format.");
            }
            
            const rows: ParsedRow[] = pdfData.map((item, index) => {
               let memberId: string | undefined;
               let memberNumber = "";
               
               const memberByName = members.find(m => 
                 m.name.toUpperCase() === item.name.toUpperCase()
               );
               
               if (memberByName) {
                 memberId = memberByName.id;
                 memberNumber = memberByName.memberNumber;
               }
               
               let productId = products[0]?.id;
               let productName = products[0]?.name || "Default Loan";
               let productMeta = products[0];
               
               let rate = 0;
               if (item.loanAmount > 0 && item.totalInterest > 0) {
                  rate = (item.totalInterest / item.loanAmount) * 100;
               } else {
                  rate = productMeta?.interestRate || 0;
               }
     
               let period = 12;
               let dateDisbursed: Date | undefined;
               
               if (item.disbursementDate) {
                  dateDisbursed = new Date(item.disbursementDate);
               }
               
               // Try to calculate period from dates if available
               if (item.disbursementDate && item.expiryDate) {
                 const start = new Date(item.disbursementDate);
                 const end = new Date(item.expiryDate);
                 if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    period = Math.ceil(diffDays / 30);
                 }
               }
     
               let status: "VALID" | "ERROR" = "VALID";
               let errorMsg = "";
     
               if (!memberId) { status = "ERROR"; errorMsg += "Member not found. "; }
               if (!productId) { status = "ERROR"; errorMsg += "No loan product avail. "; }
               if (item.loanAmount <= 0) { status = "ERROR"; errorMsg += "Invalid loan amount. "; }
               if (!dateDisbursed || isNaN(dateDisbursed.getTime())) { 
                 status = "ERROR"; 
                 errorMsg += "Invalid disbursement date. "; 
               }
               
               return {
                 rowNum: index + 1,
                 memberNumber: memberNumber || item.name,
                 productName,
                 amountGranted: item.loanAmount,
                 outstandingBalance: item.outstandingTotal || item.loanAmount,
                 dateDisbursed: item.disbursementDate,
                 period,
                 rate,
                 notes: `PDF Import. Ref: ${item.refNo || "N/A"}`,
                 status,
                 errorMsg,
                 memberId,
                 productId,
                 parsedDate: dateDisbursed
               };
            });
            
            setParsedRows(rows);
            setLoading(false);
            return;
        }

        // Handle Excel/CSV
        console.log("Starting Excel parsing for:", file.name);
        const excelReader = new FileReader();
        
        excelReader.onload = (e) => {
        };
        
        excelReader.readAsBinaryString(file);
        
      } catch (err: any) {
        setError(err.message || "Failed to parse file");
        setLoading(false);
      }

  };

  const handleMigrate = async () => {
    const validRows = parsedRows.filter(r => r.status === "VALID");
    if (validRows.length === 0) {
        toast.error("No valid rows to migrate.");
        return;
    }

    setIsProcessing(true);
    setProcessedCount(0);
    const newLog = [];
    
    // Prepare rows for batch migration via API
    const rowsToMigrate = validRows.map(row => ({
        rowNum: row.rowNum,
        memberId: row.memberId,
        memberNumber: row.memberNumber,
        loanProductId: row.productId || selectedProductId,
        amountGranted: row.amountGranted,
        outstandingBalance: row.outstandingBalance,
        dateDisbursed: row.parsedDate?.toISOString() || new Date().toISOString(),
        repaymentPeriodMonths: row.period,
        interestRate: row.rate || 0,
        notes: row.notes,
        interestPeriod: "ANNUAL" // Excel reports usually have annual rates, but we could make this dynamic
    }));

    try {
        const response = await fetch('/api/v1/loans/migrate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rows: rowsToMigrate,
                officerId: selectedOfficerId || undefined,
                productId: selectedProductId || undefined,
            }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Migration failed');
        }

        // Convert API results to audit log format
        const newLog: AuditLogEntry[] = [];
        
        // Add successful migrations
        for (let i = 0; i < result.results.successful; i++) {
            const row = validRows[i];
            if (row) {
                newLog.push({ row: row.rowNum, success: true, msg: "Success" });
            }
        }

        // Add failed migrations with error messages
        result.results.errors.forEach((error: { rowNum: number; error: string }) => {
            newLog.push({ row: error.rowNum, success: false, msg: error.error });
        });

        setAuditLog(newLog);
        setProcessedCount(validRows.length);
        setProgress(100);
        
        toast.success(`Migration complete: ${result.results.successful} successful, ${result.results.failed} failed`);
    } catch (error: any) {
        console.error('Migration API error:', error);
        toast.error(error.message || 'Migration failed');
    }

    setIsProcessing(false);
    
    const failures = newLog.filter(l => !l.success).length;
    if (failures === 0) {
        toast.success(`Successfully migrated ${validRows.length} loans!`);
        onSuccess?.();
    } else {
        toast.warning(`Completed with errors. ${failures} failed.`);
    }
  };

  const validCount = parsedRows.filter(r => r.status === "VALID").length;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 p-8 bg-background rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200">
              <div className="relative">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600 relative z-10" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg text-foreground">Processing File...</h3>
                <div className="space-y-1">
                     <p className="text-sm text-muted-foreground animate-pulse">
                      Parsing data & validating rows...
                    </p>
                    {uploadProgress < 100 && (
                        <p className="text-xs text-indigo-600 font-medium">
                            Uploading to Cloud: {uploadProgress}%
                        </p>
                    )}
                     {uploadProgress === 100 && (
                        <p className="text-xs text-green-600 font-medium flex items-center justify-center gap-1">
                           <CheckCircle className="h-3 w-3" /> Securely Uploaded
                        </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload File
              </CardTitle>
              <CardDescription>
                Upload your existing SACCO loan report (Excel format). 
              </CardDescription>
            </div>
            
            <div className="flex flex-col gap-4 min-w-[250px] sm:flex-row">
              <div className="flex flex-col gap-1.5 flex-1">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Default Officer</Label>
                <Popover open={openOfficerCombo} onOpenChange={setOpenOfficerCombo}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" size="sm" className="w-full justify-between font-normal text-xs h-9">
                      {selectedOfficerId ? currentOfficers.find((o) => o.id === selectedOfficerId)?.name : "Select handler..."}
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search officer..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>No officer found.</CommandEmpty>
                        <CommandGroup>
                          {currentOfficers.map((officer) => (
                            <CommandItem key={officer.id} value={officer.name} onSelect={() => { setSelectedOfficerId(officer.id); setOpenOfficerCombo(false); }} className="text-xs">
                              <Check className={cn("mr-2 h-3 w-3", selectedOfficerId === officer.id ? "opacity-100" : "opacity-0")} />
                              {officer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <Label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Default Product</Label>
                <Popover open={openProductCombo} onOpenChange={setOpenProductCombo}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" size="sm" className="w-full justify-between font-normal text-xs h-9">
                      {selectedProductId ? currentProducts.find((p) => p.id === selectedProductId)?.name : "Select product..."}
                      <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search product..." className="h-8 text-xs" />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {currentProducts.map((product) => (
                            <CommandItem key={product.id} value={product.name} onSelect={() => { setSelectedProductId(product.id); setOpenProductCombo(false); }} className="text-xs">
                              <Check className={cn("mr-2 h-3 w-3", selectedProductId === product.id ? "opacity-100" : "opacity-0")} />
                              {product.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <CardDescription className="mt-2">
            Required Columns: <code>Name</code>, <code>Loan Amount</code>, <code>Total Interest</code>, <code>Disbursement Date</code>, <code>Expiry Date</code>.
            Outstanding balance columns: <code>Principal</code>, <code>Interest</code>, <code>Penalty</code>, <code>Total</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
             <FileUploader onFileSelect={handleFileSelect} />
          ) : (
             <div className="flex flex-col items-center justify-center py-6 gap-4 border-2 border-dashed rounded-lg bg-muted/10">
                <div className="flex items-center gap-4 p-4 bg-background border rounded-lg shadow-sm max-w-md w-full">
                    <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                        <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={loading}>
                        <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                </div>
                
                {!loading && parsedRows.length === 0 && (
                    <Button onClick={processSelectedFile} size="lg" className="w-full max-w-sm gap-2">
                        <Loader2 className="h-4 w-4" /> 
                        Convert & Preview
                    </Button>
                )}
             </div>
          )}
        </CardContent>
      </Card>

      {parsedRows.length > 0 && (
        <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
               <div className="flex items-center justify-between">
                   <div>
                       <CardTitle>Preview Data</CardTitle>
                       <CardDescription>
                          Found {parsedRows.length} rows. {validCount} valid ready for migration.
                       </CardDescription>
                   </div>
                   <div className="flex gap-2">
                       <Button variant="outline" onClick={() => setParsedRows([])} disabled={isProcessing}>
                           Clear
                       </Button>
                       <Button onClick={handleMigrate} disabled={isProcessing || validCount === 0}>
                           {isProcessing ? (
                               <>
                                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                 Processing...
                               </>
                           ) : (
                               "Migrate Valid Rows"
                           )}
                       </Button>
                   </div>
               </div>
               {isProcessing && (
                   <div className="mt-4 space-y-2">
                       <div className="flex justify-between text-xs text-muted-foreground">
                           <span>Progress</span>
                           <span>{processedCount} / {validCount}</span>
                       </div>
                       <Progress value={progress} className="h-2" />
                   </div>
               )}
            </CardHeader>
            <div className="max-h-[500px] overflow-auto">
                <Table>
                    <TableHeader className="bg-card sticky top-0 z-10">
                        <TableRow>
                            <TableHead>Row</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Member</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Principal</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Message</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parsedRows.map((row) => (
                            <TableRow key={row.rowNum} className={row.status === "ERROR" ? "bg-destructive/5 hover:bg-destructive/10 text-destructive-foreground" : ""}>
                                <TableCell className="font-medium text-muted-foreground">#{row.rowNum}</TableCell>
                                <TableCell>
                                    {row.status === "VALID" ? (
                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                            <CheckCircle className="h-3 w-3 mr-1" /> Ready
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive">
                                            <AlertCircle className="h-3 w-3 mr-1" /> Error
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="font-medium">{row.memberNumber}</TableCell>
                                <TableCell>{row.productName}</TableCell>
                                <TableCell className="text-right">{row.amountGranted.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{row.outstandingBalance.toLocaleString()}</TableCell>
                                <TableCell>{row.parsedDate ? format(row.parsedDate, "dd MMM yyyy") : <span className="text-destructive font-bold">Invalid</span>}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={row.errorMsg || row.notes}>
                                    {row.errorMsg ? <span className="text-destructive font-bold">{row.errorMsg}</span> : row.notes || "-"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
      )}
      
       {auditLog.length > 0 && !isProcessing && (
          <Alert variant={auditLog.some(x => !x.success) ? "destructive" : "default"}>
              <Info className="h-4 w-4" />
              <AlertTitle>Migration Report</AlertTitle>
              <AlertDescription>
                  Processed {auditLog.length} rows. {auditLog.filter(x => x.success).length} successful.
                  {auditLog.some(x => !x.success) && " Some errors occurred, check the table or logs."}
              </AlertDescription>
          </Alert>
      )}
    </div>
  );
}
