// "use client";

// import { useState } from "react";
// import { format } from "date-fns";
// import { toast } from "sonner";
// import { useRouter } from "next/navigation";
// import { Column, DataTable } from "@/components/ui/data-table";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
// } from "@/components/ui/card";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuLabel,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import {
//   FileText,
//   Download,
//   Mail,
//   Eye,
//   Trash2,
//   Plus,
//   TrendingUp,
//   Calendar,
//   Users,
//   MoreHorizontal,
//   Printer,
// } from "lucide-react";
// import { Statement } from "@/types/statements";

// import StatementCreateForm from "./StatementCreateForm";
// import { pdf } from "@react-pdf/renderer";
// import SimpleStatementPDF from "@/components/pdf/StatementPDFDocument";
// import {
//   deleteStatement,
//   getMemberStatementData,
// } from "@/actions/statement-actions";
// import { sendStatementEmail } from "@/actions/statements";

// interface StatementListingProps {
//   statements: Statement[];
//   title: string;
//   subtitle: string;
//   statistics: {
//     today: number;
//     thisMonth: number;
//     total: number;
//   };
//   userRole: string;
//   currentUserId: string;
// }

// export default function StatementListing({
//   statements,
//   title,
//   subtitle,
//   statistics,
//   userRole,
//   currentUserId,
// }: StatementListingProps) {
//   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
//   const router = useRouter();

//   // Generate PDF blob for reuse
//   const generatePDFBlob = async (statement: Statement) => {
//     const statementData = await getMemberStatementData(
//       statement.memberId,
//       statement.periodStart,
//       statement.periodEnd
//     );

//     const pdfDoc = (
//       <SimpleStatementPDF
//         data={statementData}
//         periodStart={statement.periodStart}
//         periodEnd={statement.periodEnd}
//         organizationName="BUTSACCO"
//         organizationAddress="123 Main Street, Kampala, Uganda"
//         organizationPhone="+256 123 456 789"
//         organizationEmail="info@bukonzounitedteacherscooperativesociety.com"
//       />
//     );

//     return await pdf(pdfDoc).toBlob();
//   };

//   // Handle download PDF
//   const handleDownloadPDF = async (statement: Statement) => {
//     try {
//       toast.loading("Generating PDF...", { id: "pdf-generation" });

//       const blob = await generatePDFBlob(statement);
//       const url = URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href = url;
//       link.download = `statement_${statement.member.memberNumber}_${format(
//         new Date(statement.periodStart),
//         "yyyy-MM-dd"
//       )}_${format(new Date(statement.periodEnd), "yyyy-MM-dd")}.pdf`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       URL.revokeObjectURL(url);

//       toast.success("PDF downloaded successfully!", { id: "pdf-generation" });
//     } catch (error) {
//       console.error("Error generating PDF:", error);
//       toast.error("Failed to generate PDF", { id: "pdf-generation" });
//     }
//   };

//   // Handle print statement
//   const handlePrintStatement = async (statement: Statement) => {
//     try {
//       toast.loading("Preparing statement for printing...", { id: "pdf-print" });

//       const blob = await generatePDFBlob(statement);
//       const url = URL.createObjectURL(blob);

//       // Open in new window for printing
//       const printWindow = window.open(url, "_blank");

//       if (printWindow) {
//         printWindow.onload = () => {
//           printWindow.print();
//           toast.success("Print dialog opened!", { id: "pdf-print" });
//         };
//       } else {
//         toast.error("Please allow popups to print statements", {
//           id: "pdf-print",
//         });
//       }

//       // Clean up after a delay
//       setTimeout(() => URL.revokeObjectURL(url), 10000);
//     } catch (error) {
//       console.error("Error preparing statement for print:", error);
//       toast.error("Failed to prepare statement for printing", {
//         id: "pdf-print",
//       });
//     }
//   };

//   // Handle send email
//   const handleSendEmail = async (statement: Statement) => {
//     try {
//       toast.loading("Sending statement via email...", { id: "email-send" });

//       const blob = await generatePDFBlob(statement);

//       // Convert blob to base64
//       const base64String = await new Promise<string>((resolve) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(blob);
//         reader.onloadend = () => {
//           const base64data = reader.result as string;
//           resolve(base64data.split(",")[1]);
//         };
//       });

//       const filename = `statement_${statement.member.memberNumber}_${format(
//         new Date(statement.periodStart),
//         "yyyy-MM-dd"
//       )}_${format(new Date(statement.periodEnd), "yyyy-MM-dd")}.pdf`;

//       // Send email using server action
//       const result = await sendStatementEmail({
//         statementId: statement.id,
//         recipientEmail: statement.member.user.email,
//         recipientName: statement.member.user.name,
//         memberNumber: statement.member.memberNumber,
//         periodStart: statement.periodStart,
//         periodEnd: statement.periodEnd,
//         pdfBase64: base64String,
//         filename: filename,
//       });

//       if (result.success) {
//         toast.success("Statement sent successfully!", {
//           id: "email-send",
//           description: `Email sent to ${statement.member.user.email}`,
//         });
//       } else {
//         toast.error("Failed to send email", {
//           id: "email-send",
//           description: result.error,
//         });
//       }
//     } catch (error) {
//       console.error("Error sending email:", error);
//       toast.error("Failed to send statement via email", { id: "email-send" });
//     }
//   };

//   // Handle view statement
//   const handleView = (statement: Statement) => {
//     router.push(`/dashboard/statements/${statement.id}`);
//   };

//   // Handle delete statement
//   const handleDelete = async (statement: Statement) => {
//     if (
//       !confirm(
//         "Are you sure you want to delete this statement? This action cannot be undone."
//       )
//     ) {
//       return;
//     }

//     try {
//       const result = await deleteStatement(statement.id);
//       if (result.success) {
//         toast.success("Statement deleted successfully");
//         router.refresh();
//       } else {
//         toast.error(result.error || "Failed to delete statement");
//       }
//     } catch (error) {
//       toast.error("Failed to delete statement");
//     }
//   };

//   // Define columns for the data table
//   const columns: Column<Statement>[] = [
//     {
//       header: "Member",
//       accessorKey: "memberId",
//       cell: (row: Statement) => (
//         <div className="flex items-center gap-3">
//           <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
//             {row.member.user.image ? (
//               <img
//                 src={row.member.user.image}
//                 alt={row.member.user.name}
//                 className="h-10 w-10 rounded-full object-cover"
//               />
//             ) : (
//               <Users className="h-5 w-5" />
//             )}
//           </div>
//           <div>
//             <p className="font-medium text-gray-900">{row.member.user.name}</p>
//             <p className="text-sm text-gray-500">#{row.member.memberNumber}</p>
//           </div>
//         </div>
//       ),
//     },
//     {
//       header: "Period",
//       accessorKey: "periodStart",
//       cell: (row: Statement) => (
//         <div>
//           <p className="font-medium text-gray-900">
//             {format(new Date(row.periodStart), "MMM dd, yyyy")}
//           </p>
//           <p className="text-sm text-gray-500">
//             to {format(new Date(row.periodEnd), "MMM dd, yyyy")}
//           </p>
//         </div>
//       ),
//     },
//     {
//       header: "Accounts",
//       accessorKey: "memberId",
//       cell: (row: Statement) => (
//         <div className="flex flex-col gap-1">
//           <p className="font-medium text-gray-900">
//             {row.member.accounts.length} Accounts
//           </p>
//           <div className="flex gap-1 flex-wrap">
//             {row.member.accounts.slice(0, 2).map((account) => (
//               <Badge key={account.id} variant="secondary" className="text-xs">
//                 {account.accountType.name.replace("_", " ")}
//               </Badge>
//             ))}
//             {row.member.accounts.length > 2 && (
//               <Badge variant="secondary" className="text-xs">
//                 +{row.member.accounts.length - 2}
//               </Badge>
//             )}
//           </div>
//         </div>
//       ),
//     },
//     {
//       header: "Generated",
//       accessorKey: "generatedAt",
//       cell: (row: Statement) => (
//         <div>
//           <p className="font-medium text-gray-900">
//             {format(new Date(row.generatedAt), "MMM dd, yyyy")}
//           </p>
//           <p className="text-sm text-gray-500">
//             {format(new Date(row.generatedAt), "hh:mm a")}
//           </p>
//         </div>
//       ),
//     },
//     {
//       header: "Generated By",
//       accessorKey: "userId",
//       cell: (row: Statement) => (
//         <div>
//           <p className="font-medium text-gray-900">
//             {row.generatedByUser?.name || "System"}
//           </p>
//           <p className="text-sm text-gray-500">
//             {row.generatedByUser?.role || "Automated"}
//           </p>
//         </div>
//       ),
//     },
//     {
//       header: "Status",
//       accessorKey: "pdfPath",
//       cell: (row: Statement) => (
//         <Badge variant={row.pdfPath ? "default" : "secondary"}>
//           {row.pdfPath ? "Generated" : "Pending"}
//         </Badge>
//       ),
//     },
//     {
//       header: "Actions",
//       accessorKey: "id",
//       cell: (row: Statement) => (
//         <DropdownMenu>
//           <DropdownMenuTrigger asChild>
//             <Button variant="ghost" className="h-8 w-8 p-0">
//               <span className="sr-only">Open menu</span>
//               <MoreHorizontal className="h-4 w-4" />
//             </Button>
//           </DropdownMenuTrigger>
//           <DropdownMenuContent align="end">
//             <DropdownMenuLabel>Actions</DropdownMenuLabel>
//             <DropdownMenuItem onClick={() => handleView(row)}>
//               <Eye className="mr-2 h-4 w-4" />
//               View Details
//             </DropdownMenuItem>
//             <DropdownMenuItem onClick={() => handlePrintStatement(row)}>
//               <Printer className="mr-2 h-4 w-4" />
//               Print Statement
//             </DropdownMenuItem>
//             <DropdownMenuItem onClick={() => handleDownloadPDF(row)}>
//               <Download className="mr-2 h-4 w-4" />
//               Download PDF
//             </DropdownMenuItem>
//             <DropdownMenuItem onClick={() => handleSendEmail(row)}>
//               <Mail className="mr-2 h-4 w-4" />
//               Send via Email
//             </DropdownMenuItem>
//             <DropdownMenuSeparator />
//             <DropdownMenuItem
//               onClick={() => handleDelete(row)}
//               className="text-red-600"
//             >
//               <Trash2 className="mr-2 h-4 w-4" />
//               Delete
//             </DropdownMenuItem>
//           </DropdownMenuContent>
//         </DropdownMenu>
//       ),
//     },
//   ];

//   return (
//     <div className="space-y-6">
//       {/* Statistics Cards */}
//       <div className="grid gap-4 md:grid-cols-3">
//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Today's Statements
//             </CardTitle>
//             <Calendar className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{statistics.today}</div>
//             <p className="text-xs text-muted-foreground">Generated today</p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">This Month</CardTitle>
//             <TrendingUp className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{statistics.thisMonth}</div>
//             <p className="text-xs text-muted-foreground">
//               Generated this month
//             </p>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//             <CardTitle className="text-sm font-medium">
//               Total Statements
//             </CardTitle>
//             <FileText className="h-4 w-4 text-muted-foreground" />
//           </CardHeader>
//           <CardContent>
//             <div className="text-2xl font-bold">{statistics.total}</div>
//             <p className="text-xs text-muted-foreground">All time</p>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Main Data Table */}
//       <Card>
//         <CardHeader>
//           <div className="flex items-center justify-between">
//             <div>
//               <CardTitle>{title}</CardTitle>
//               <CardDescription>{subtitle}</CardDescription>
//             </div>
//             <div className="flex gap-2">
//               <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
//                 <Plus className="h-4 w-4 mr-2" />
//                 Generate Statement
//               </Button>
//             </div>
//           </div>
//         </CardHeader>
//         <CardContent>
//           <DataTable<Statement>
//             title="Statements"
//             columns={columns}
//             data={statements}
//             keyField="id"
//           />
//         </CardContent>
//       </Card>

//       {/* Create Statement Modal */}
//       <StatementCreateForm
//         isOpen={isCreateModalOpen}
//         onClose={() => setIsCreateModalOpen(false)}
//         currentUserId={currentUserId}
//       />
//     </div>
//   );
// }
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Column, DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Download,
  Mail,
  Eye,
  Trash2,
  Plus,
  TrendingUp,
  Calendar,
  Users,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { Statement } from "@/types/statements";

import StatementCreateForm from "./StatementCreateForm";
import { pdf } from "@react-pdf/renderer";
import SimpleStatementPDF from "@/components/pdf/StatementPDFDocument";

interface StatementListingProps {
  statements: Statement[];
  title: string;
  subtitle: string;
  statistics: {
    today: number;
    thisMonth: number;
    total: number;
  };
  userRole: string;
  currentUserId: string;
}

export default function StatementListing({
  statements: initialStatements,
  title,
  subtitle,
  statistics,
  userRole,
  currentUserId,
}: StatementListingProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statements, setStatements] = useState(initialStatements);
  const router = useRouter();

  const getStatementSubject = (statement: Statement) => ({
    name:
      statement.member?.user.name ||
      statement.institution?.institutionName ||
      "Statement Subject",
    email:
      statement.member?.user.email ||
      statement.institution?.institutionEmail ||
      "",
    number:
      statement.member?.memberNumber ||
      statement.institution?.institutionNumber ||
      "N/A",
    image: statement.member?.user.image || null,
    accounts: statement.member?.accounts || statement.institution?.accounts || [],
  });

  // Helper to safely convert to Date
  const toDate = (date: Date | string | null | undefined): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    return new Date(date);
  };

  // Fetch statement data from API
  const fetchStatementData = async (statementId: string) => {
    const response = await fetch(`/api/v1/statements/${statementId}/data`);
    if (!response.ok) throw new Error("Failed to fetch statement data");
    const result = await response.json();
    return result.data;
  };

  // Generate PDF blob for reuse
  const generatePDFBlob = async (statement: Statement) => {
    const statementData = await fetchStatementData(statement.id);

    // Safely handle dates
    const startDate = toDate(statement.startDate);
    const endDate = toDate(statement.endDate);

    const pdfDoc = (
      <SimpleStatementPDF
        data={statementData}
        periodStart={startDate}
        periodEnd={endDate}
        organizationName="BUTSACCO"
        organizationAddress="123 Main Street, Kampala, Uganda"
        organizationPhone="+256 123 456 789"
        organizationEmail="info@bukonzounitedteacherscooperativesociety.com"
      />
    );

    return await pdf(pdfDoc).toBlob();
  };

  // Handle download PDF
  const handleDownloadPDF = async (statement: Statement) => {
    try {
      toast.loading("Generating PDF...", { id: "pdf-generation" });
      const subject = getStatementSubject(statement);

      const blob = await generatePDFBlob(statement);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement_${subject.number}_${format(
        toDate(statement.startDate),
        "yyyy-MM-dd"
      )}_${format(toDate(statement.endDate), "yyyy-MM-dd")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully!", { id: "pdf-generation" });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF", { id: "pdf-generation" });
    }
  };

  // Handle print statement
  const handlePrintStatement = async (statement: Statement) => {
    try {
      toast.loading("Preparing statement for printing...", { id: "pdf-print" });

      const blob = await generatePDFBlob(statement);
      const url = URL.createObjectURL(blob);

      // Open in new window for printing
      const printWindow = window.open(url, "_blank");

      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          toast.success("Print dialog opened!", { id: "pdf-print" });
        };
      } else {
        toast.error("Please allow popups to print statements", {
          id: "pdf-print",
        });
      }

      // Clean up after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Error preparing statement for print:", error);
      toast.error("Failed to prepare statement for printing", {
        id: "pdf-print",
      });
    }
  };

  // Handle send email
  const handleSendEmail = async (statement: Statement) => {
    try {
      toast.loading("Sending statement via email...", { id: "email-send" });
      const subject = getStatementSubject(statement);

      const blob = await generatePDFBlob(statement);

      // Convert blob to base64
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data.split(",")[1]);
        };
      });

      const filename = `statement_${subject.number}_${format(
        toDate(statement.startDate),
        "yyyy-MM-dd"
      )}_${format(toDate(statement.endDate), "yyyy-MM-dd")}.pdf`;

      // Send email using API endpoint
      const response = await fetch(`/api/v1/statements/${statement.id}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail: subject.email,
          recipientName: subject.name,
          memberNumber: subject.number,
          periodStart: toDate(statement.startDate).toISOString(),
          periodEnd: toDate(statement.endDate).toISOString(),
          pdfBase64: base64String,
          filename: filename,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Statement sent successfully!", {
          id: "email-send",
          description: `Email sent to ${subject.email}`,
        });
      } else {
        toast.error("Failed to send email", {
          id: "email-send",
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send statement via email", { id: "email-send" });
    }
  };

  // Handle view statement
  const handleView = (statement: Statement) => {
    router.push(`/dashboard/statements/${statement.id}`);
  };

  // Handle delete statement
  const handleDelete = async (statement: Statement) => {
    if (
      !confirm(
        "Are you sure you want to delete this statement? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/statements/${statement.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Statement deleted successfully");
        // Remove from local state
        setStatements((prev) => prev.filter((s) => s.id !== statement.id));
      } else {
        toast.error(result.error || "Failed to delete statement");
      }
    } catch (error) {
      toast.error("Failed to delete statement");
    }
  };

  // Define columns for the data table
  const columns: Column<Statement>[] = [
    {
      header: "Subject",
      accessorKey: "memberId",
      cell: (row: Statement) => {
        const subject = getStatementSubject(row);
        return (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {subject.image ? (
              <img
                src={subject.image}
                alt={subject.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <Users className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{subject.name}</p>
            <p className="text-sm text-gray-500">#{subject.number}</p>
          </div>
        </div>
      )},
    },
    {
      header: "Period",
      accessorKey: "startDate",
      cell: (row: Statement) => (
        <div>
          <p className="font-medium text-gray-900">
            {format(toDate(row.startDate), "MMM dd, yyyy")}
          </p>
          <p className="text-sm text-gray-500">
            to {format(toDate(row.endDate), "MMM dd, yyyy")}
          </p>
        </div>
      ),
    },
    {
      header: "Accounts",
      accessorKey: "memberId",
      cell: (row: Statement) => {
        const accounts = getStatementSubject(row).accounts;
        return (
        <div className="flex flex-col gap-1">
          <p className="font-medium text-gray-900">
            {accounts.length} Accounts
          </p>
          <div className="flex gap-1 flex-wrap">
            {accounts.slice(0, 2).map((account) => (
              <Badge key={account.id} variant="secondary" className="text-xs">
                {account.accountType.name.replace("_", " ")}
              </Badge>
            ))}
            {accounts.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{accounts.length - 2}
              </Badge>
            )}
          </div>
        </div>
      )},
    },
    {
      header: "Generated",
      accessorKey: "statementDate",
      cell: (row: Statement) => (
        <div>
          <p className="font-medium text-gray-900">
            {format(toDate(row.statementDate), "MMM dd, yyyy")}
          </p>
          <p className="text-sm text-gray-500">
            {format(toDate(row.statementDate), "hh:mm a")}
          </p>
        </div>
      ),
    },
    {
      header: "Generated By",
      accessorKey: "userId",
      cell: (row: Statement) => (
        <div>
          <p className="font-medium text-gray-900">
            {row.generatedByUser?.name || "System"}
          </p>
          <p className="text-sm text-gray-500">
            {row.generatedByUser?.role || "Automated"}
          </p>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "pdfPath",
      cell: (row: Statement) => (
        <Badge variant={row.pdfPath ? "default" : "secondary"}>
          {row.pdfPath ? "Generated" : "Pending"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: Statement) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleView(row)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlePrintStatement(row)}>
              <Printer className="mr-2 h-4 w-4" />
              Print Statement
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadPDF(row)}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSendEmail(row)}>
              <Mail className="mr-2 h-4 w-4" />
              Send via Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(row)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Statements
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.today}</div>
            <p className="text-xs text-muted-foreground">Generated today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.thisMonth}</div>
            <p className="text-xs text-muted-foreground">
              Generated this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Statements
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generate Statement
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable<Statement>
            title="Statements"
            columns={columns}
            data={statements}
            keyField="id"
          />
        </CardContent>
      </Card>

      {/* Create Statement Modal */}
      <StatementCreateForm
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          // Refresh statements after creation
          router.refresh();
        }}
        currentUserId={currentUserId}
      />
    </div>
  );
}
