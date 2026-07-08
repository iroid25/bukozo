// import { OurFileRouter } from "@/app/api/uploadthing/core";
// import {
//   generateUploadButton,
//   generateUploadDropzone,
//   generateReactHelpers,
// } from "@uploadthing/react";

// export const UploadButton = generateUploadButton<OurFileRouter>();
// export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// // Helper hooks (use in components)
// export const { useUploadThing } = generateReactHelpers<OurFileRouter>();

// // New PDF upload function
// export async function uploadPDFToUploadThing(
//   pdfBuffer: Buffer,
//   fileName: string
// ): Promise<string> {
//   try {
//     const formData = new FormData();
//     const blob = new Blob([pdfBuffer], { type: "application/pdf" });
//     formData.append("file", blob, fileName);

//     const response = await fetch("/api/uploadthing", {
//       method: "POST",
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error(`Upload failed: ${response.statusText}`);
//     }

//     const data = await response.json();
//     return data.url; // Returns public URL
//   } catch (error) {
//     console.error("UploadThing error:", error);
//     throw new Error("Failed to upload PDF");
//   }
// }
import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";

import type { OurFileRouter } from "@/app/api/uploadthing/core";
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();
