// app/api/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing({
  errorFormatter: (err) => {
    console.error("❌ UploadThing Error:", err);
    return {
      message: err.message,
      code: err.code,
      data: err.data,
    };
  },
});

const auth = () => {
  const userId = "authenticated-user";
  if (!userId) throw new UploadThingError("Unauthorized");
  return { userId };
};

export const ourFileRouter = {
  userProfileImage: f({
    image: {
      maxFileSize: "2MB",
      maxFileCount: 1,
    },
  }, {
    awaitServerData: false,
  })
    .middleware(async ({ req }) => {
      console.log("🔐 Auth middleware started");
      const user = auth();
      console.log("✅ Auth successful:", user);
      return user;
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("✅ Upload complete!");
      console.log("📁 File URL:", file.url);
      console.log("👤 User ID:", metadata.userId);
      return { url: file.url };
    }),

  categoryImage: f({ image: { maxFileSize: "1MB" } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  itemImage: f({ image: { maxFileSize: "1MB" } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  itemImages: f({ image: { maxFileSize: "2MB", maxFileCount: 4 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  blogImage: f({ image: { maxFileSize: "1MB" } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  profileImage: f({ image: { maxFileSize: "4MB" } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  cardImages: f({ image: { maxFileSize: "4MB" } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  institutionAdminPhoto: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  institutionAdminSignature: f({
    image: { maxFileSize: "1MB", maxFileCount: 10 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  institutionDocuments: f({ image: { maxFileSize: "2MB", maxFileCount: 20 } })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  memberSignature: f({
    image: { maxFileSize: "1MB", maxFileCount: 1 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  fileUploads: f({
    image: { maxFileSize: "1MB", maxFileCount: 4 },
    pdf: { maxFileSize: "1MB", maxFileCount: 4 },
    "application/msword": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "1MB",
      maxFileCount: 4,
    },
    "application/vnd.ms-excel": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "1MB",
      maxFileCount: 4,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      {
        maxFileSize: "1MB",
        maxFileCount: 4,
      },
    "text/plain": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/gzip": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/zip": { maxFileSize: "1MB", maxFileCount: 4 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  migrationFile: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "text/csv": { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),

  mailAttachments: f({
    image: { maxFileSize: "1MB", maxFileCount: 4 },
    pdf: { maxFileSize: "1MB", maxFileCount: 4 },
    "application/msword": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "1MB",
      maxFileCount: 4,
    },
    "application/vnd.ms-excel": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "1MB",
      maxFileCount: 4,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      {
        maxFileSize: "1MB",
        maxFileCount: 4,
      },
    "text/plain": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/gzip": { maxFileSize: "1MB", maxFileCount: 4 },
    "application/zip": { maxFileSize: "1MB", maxFileCount: 4 },
  })
    .middleware(async () => auth())
    .onUploadComplete(async ({ file }) => ({ url: file.url })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
