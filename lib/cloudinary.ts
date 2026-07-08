// lib/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
export async function uploadPDFToCloudinary(
  pdfBuffer: Buffer,
  fileName: string
): Promise<string> {
  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "raw",
            public_id: fileName, // Just the filename (no folder prefix)
            folder: "sacco-statements/statements", // Folders merged here
            type: "upload",
            access_mode: "public",
            sign_url: false, // Disable URL signing (public access)
            // Remove unused options for raw uploads:
            // use_filename: true,  // Not needed for raw
            // unique_filename: false, // Not needed for raw
            tags: ["statement", "pdf"],
            context: {
              purpose: "bank_statement",
              generated_at: new Date().toISOString(),
            },
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              reject(error);
            } else {
              // Return the secure_url (publicly accessible)
              resolve(result!.secure_url);
            }
          }
        )
        .end(pdfBuffer);
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload PDF to Cloudinary");
  }
}

// Optional: Add a function to generate optimized URLs for different use cases
export function getOptimizedPDFUrl(
  publicId: string,
  options?: {
    download?: boolean;
    filename?: string;
  }
) {
  const baseUrl = cloudinary.url(publicId, {
    resource_type: "raw",
    type: "upload",
    secure: true, // Always use HTTPS
  });

  // If download is requested, add download parameter
  if (options?.download) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const filename = options.filename
      ? `&filename=${encodeURIComponent(options.filename)}`
      : "";
    return `${baseUrl}${separator}fl_attachment${filename}`;
  }

  return baseUrl;
}

// Function to delete a PDF from Cloudinary (for cleanup)
export async function deletePDFFromCloudinary(
  publicId: string
): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    });

    return result.result === "ok";
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return false;
  }
}

// Function to get file info from Cloudinary
export async function getPDFInfo(publicId: string) {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: "raw",
    });

    return {
      url: result.secure_url,
      size: result.bytes,
      created: result.created_at,
      format: result.format,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Error getting PDF info:", error);
    return null;
  }
}

// Enhanced version with better error handling and options
export async function uploadPDFToCloudinaryEnhanced(
  pdfBuffer: Buffer,
  fileName: string,
  options?: {
    memberNumber?: string;
    periodStart?: string;
    periodEnd?: string;
    generateThumbnail?: boolean;
  }
): Promise<{
  url: string;
  publicId: string;
  size: number;
}> {
  try {
    // Clean filename to ensure it's URL-safe
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "raw",
            public_id: `statements/${cleanFileName}`,
            folder: "sacco-statements",
            use_filename: true,
            unique_filename: false,
            access_mode: "public",
            tags: [
              "statement",
              "pdf",
              "sacco",
              ...(options?.memberNumber
                ? [`member_${options.memberNumber}`]
                : []),
            ],
            context: {
              purpose: "bank_statement",
              generated_at: new Date().toISOString(),
              member_number: options?.memberNumber || "",
              period_start: options?.periodStart || "",
              period_end: options?.periodEnd || "",
            },
            // Add metadata for better organization
            metadata: {
              type: "bank_statement",
              member: options?.memberNumber || "unknown",
              period:
                options?.periodStart && options?.periodEnd
                  ? `${options.periodStart}_to_${options.periodEnd}`
                  : "unknown",
            },
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              reject(error);
            } else {
              resolve({
                url: result!.secure_url,
                publicId: result!.public_id,
                size: result!.bytes,
              });
            }
          }
        )
        .end(pdfBuffer);
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw new Error("Failed to upload PDF to Cloudinary");
  }
}

// Update your actions/statements.ts to use the enhanced version:
/*
// In createStatement function, replace the upload call:

const uploadResult = await uploadPDFToCloudinaryEnhanced(
  pdfBuffer, 
  fileName,
  {
    memberNumber: member.memberNumber,
    periodStart: format(data.periodStart, 'yyyy-MM-dd'),
    periodEnd: format(data.periodEnd, 'yyyy-MM-dd'),
  }
);

const fileUrl = uploadResult.url;

// Optionally store additional metadata in database:
const statement = await db.statement.create({
  data: {
    memberId: data.memberId,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    fileUrl: uploadResult.url,
    // Add these fields to your Prisma schema if needed:
    // cloudinaryPublicId: uploadResult.publicId,
    // fileSize: uploadResult.size,
    generatedByUserId: generatedByUserId,
  },
  // ... rest of your include
});
*/

// Cloudinary Dashboard Settings (Manual Configuration):
/*
To ensure maximum public accessibility, also configure these in your Cloudinary Dashboard:

1. Go to Settings > Upload
2. Set "Upload preset" to "unsigned" if you want to allow unsigned uploads
3. Under "Access Control":
   - Set default access mode to "public"
   - Enable "Allow public access to all resources"

4. Under "Media Management":
   - Enable "Auto-backup" for important files
   - Set appropriate "Auto-expiry" if needed

5. Under "Security":
   - Configure "Allowed domains" if you want to restrict access
   - Set up "Secure URLs" if you need signed URLs for sensitive content
*/

// Environment Variables (add to .env.local):
/*
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional: Cloudinary Upload Preset (if using unsigned uploads)
CLOUDINARY_UPLOAD_PRESET=your_upload_preset
*/

// Example usage in your components:
/*
// For viewing PDF in browser:
const viewUrl = getOptimizedPDFUrl(statement.cloudinaryPublicId);
window.open(viewUrl, '_blank');

// For downloading PDF with custom filename:
const downloadUrl = getOptimizedPDFUrl(
  statement.cloudinaryPublicId, 
  { 
    download: true, 
    filename: `statement_${statement.member.memberNumber}.pdf` 
  }
);
window.open(downloadUrl, '_blank');
*/
