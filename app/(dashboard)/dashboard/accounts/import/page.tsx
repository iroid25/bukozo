"use client";

import React, { useState } from "react";
import { read, utils } from "xlsx";
import { toast } from "sonner";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportAccountRow, ImportResult } from "@/actions/importAccounts";
import { useRouter } from "next/navigation";

export default function ImportAccountsPage() {
  const router = useRouter();
  const [data, setData] = useState<ImportAccountRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    setResult(null);
    setLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json(worksheet) as any[];

      // Basic mapping (case insensitive header check could be added)
      const mappedData: ImportAccountRow[] = jsonData.map((row) => ({
        accountNumber: row["Account Number"] || row["accountNumber"] || "",
        memberNumber: row["Member Number"] || row["memberNumber"],
        institutionNumber: row["Institution Number"] || row["institutionNumber"],
        accountTypeName: row["Account Type"] || row["accountTypeName"] || "",
        branchName: row["Branch"] || row["branchName"],
        balance: row["Balance"] || row["balance"] || 0,
        openedAt: row["Opened Date"] || row["openedAt"],
      }));

      // Filter empty rows
      const cleanData = mappedData.filter(d => d.accountNumber && d.accountTypeName);
      setData(cleanData);
      
      if (cleanData.length === 0) {
        toast.error("No valid data found in file. Please check column headers.");
      } else {
        toast.success(`Loaded ${cleanData.length} records`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/v1/accounts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const response = await res.json();
      if (response.data) {
        setResult(response.data);
        if (response.data.failed === 0) {
          toast.success("Import Completed Successfully!");
          router.refresh();
        } else {
          toast.warning(`Import Completed with ${response.data.failed} errors`);
        }
      } else {
        toast.error(response.error || "Import failed");
      }
    } catch (error) {
      toast.error("Something went wrong during import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Bulk Account Import</h1>
        <Button variant="outline" onClick={() => router.back()}>
            Back
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
         {/* Upload Card */}
         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Data
             </CardTitle>
             <CardDescription>
                Upload a CSV or Excel file containing historical accounts.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="flex flex-col gap-4">
                <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors">
                    <FileSpreadsheet className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-sm font-medium">Click to select file</p>
                    <p className="text-xs text-gray-500 mt-1">.csv, .xlsx supported</p>
                    <input 
                       type="file" 
                       accept=".csv, .xlsx, .xls"
                       className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                       style={{ position: 'relative', height: '100px', opacity: 0 }}
                       onChange={handleFileUpload}
                    />
                </div>

                <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                    <p className="font-semibold mb-1">Required Columns:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Account Number</li>
                        <li>Account Type (Name)</li>
                        <li>Member Number OR Institution Number</li>
                        <li>Balance</li>
                        <li>Branch (Optional)</li>
                    </ul>
                </div>
             </div>
           </CardContent>
         </Card>

         {/* Results Card */}
         {result && (
             <Card>
                 <CardHeader>
                     <CardTitle>Import Results</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                     <div className="grid grid-cols-3 gap-4 text-center">
                         <div className="p-4 bg-gray-100 rounded-lg">
                             <div className="text-2xl font-bold">{result.total}</div>
                             <div className="text-xs text-gray-500 uppercase">Total</div>
                         </div>
                         <div className="p-4 bg-green-100 text-green-700 rounded-lg">
                             <div className="text-2xl font-bold">{result.success}</div>
                             <div className="text-xs uppercase">Success</div>
                         </div>
                         <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                             <div className="text-2xl font-bold">{result.failed}</div>
                             <div className="text-xs uppercase">Failed</div>
                         </div>
                     </div>

                     {result.errors.length > 0 && (
                         <div className="mt-4 border rounded-md max-h-60 overflow-y-auto bg-red-50 p-2">
                             <p className="font-medium text-red-800 mb-2 px-2">Error Details:</p>
                             <ul className="space-y-2">
                                 {result.errors.slice(0, 50).map((err, idx) => (
                                     <li key={idx} className="text-sm text-red-700 px-2 py-1 border-b border-red-100 last:border-0">
                                         Row {err.row}: {err.error}
                                     </li>
                                 ))}
                             </ul>
                         </div>
                     )}
                 </CardContent>
             </Card>
         )}
      </div>

      {/* Preview Table */}
      {data.length > 0 && !result && (
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Data Preview</CardTitle>
                    <CardDescription>Review the data before importing. Only showing first 5 rows.</CardDescription>
                  </div>
                  <Button onClick={handleImport} disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      Import {data.length} Accounts
                  </Button>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Account #</TableHead>
                              <TableHead>Owner #</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Branch</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {data.slice(0, 5).map((row, i) => (
                              <TableRow key={i}>
                                  <TableCell>{row.accountNumber}</TableCell>
                                  <TableCell>{row.memberNumber || row.institutionNumber}</TableCell>
                                  <TableCell>{row.accountTypeName}</TableCell>
                                  <TableCell>{row.branchName || '-'}</TableCell>
                                  <TableCell className="text-right">{row.balance}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      )}
    </div>
  );
}
