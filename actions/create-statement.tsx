// @ts-nocheck
"use server";
import { renderToBuffer } from "@react-pdf/renderer";

// import { uploadPDFToCloudinary } from "@/lib/cloudinary";
import { sendStatementEmail } from "@/lib/email";
import { format } from "date-fns";
import { StatementCreateDTO } from "@/types/statements";
import { db } from "@/prisma/db";
import { getMemberStatementData } from "./statement-actions";
import SimpleStatementPDF from "@/components/pdf/StatementPDFDocument";
import { revalidatePath } from "next/cache";
// import { uploadPDFToUploadThing } from "@/lib/uploadthing";

export async function createMemberStatement(
  data: StatementCreateDTO,
  generatedByUserId: string
) {
  try {
    // Validate member exists
    const member = await db.member.findUnique({
      where: { id: data.memberId },
      include: {
        user: true,
      },
    });

    if (!member) {
      return {
        error: "Member not found",
        data: null,
      };
    }

    // Validate date range
    if (data.periodStart >= data.periodEnd) {
      return {
        error: "Period start date must be before period end date",
        data: null,
      };
    }

    // Check if statement already exists for this period
    const existingStatement = await db.statement.findFirst({
      where: {
        memberId: data.memberId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      },
    });

    if (existingStatement) {
      return {
        error: "Statement already exists for this period",
        data: existingStatement,
      };
    }

    // Get detailed statement data
    const statementData = await getMemberStatementData(
      data.memberId,
      data.periodStart,
      data.periodEnd
    );

    // Generate PDF using React-PDF
    const pdfDoc = (
      <SimpleStatementPDF
        data={statementData}
        organizationName="Your SACCO Bank"
        organizationAddress="123 Main Street, Kampala, Uganda"
        organizationPhone="+256 123 456 789"
        organizationEmail="info@yoursacco.com"
      />
    );

    // Generate PDF buffer
    console.log("Generating PDF buffer...");
    const pdfBuffer = await renderToBuffer(pdfDoc);
    console.log("PDF buffer generated successfully");

    // Create filename
    const fileName = `statement_${member.memberNumber}_${format(data.periodStart, "yyyy-MM-dd")}_${format(data.periodEnd, "yyyy-MM-dd")}.pdf`;

    // Upload to Cloudinary
    console.log("Uploading to Cloudinary...");
    // const fileUrl = await uploadPDFToUploadThing(pdfBuffer, fileName);
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    formData.append("file", blob, fileName);

    const response = await fetch("/api/uploadthing", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const res = await response.json();
    const fileUrl = res.url;
    // const fileUrl = await uploadPDFToCloudinary(pdfBuffer, fileName);
    console.log("Upload successful:", fileUrl);

    // Create statement record
    const statement = await db.statement.create({
      data: {
        memberId: data.memberId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        fileUrl: fileUrl,
        generatedByUserId: generatedByUserId,
      },
      include: {
        member: {
          include: {
            user: true,
          },
        },
        generatedByUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Send email with statement attachment
    try {
      console.log("Sending email...");
      const statementPeriod = `${format(data.periodStart, "MMM dd, yyyy")} - ${format(data.periodEnd, "MMM dd, yyyy")}`;

      await sendStatementEmail(
        member.user.email,
        member.user.name,
        statementPeriod,
        fileUrl,
        fileName
      );

      console.log("Email sent successfully to:", member.user.email);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail the entire operation if email fails
      // You might want to log this for manual follow-up
    }

    revalidatePath("/dashboard/statements");
    return {
      error: null,
      data: statement,
    };
  } catch (error) {
    console.error("Error creating statement:", error);
    return {
      error: "Failed to generate statement. Please try again.",
      data: null,
    };
  }
}
