import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { UTApi, UTFile } from "uploadthing/server";
import { getAuthUser } from "@/config/useAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_IMAGE_DIR =
  process.env.BUS_IMAGE_DIR ||
  (process.platform === "win32"
    ? "C:\\busimages"
    : join(os.tmpdir(), "busimages"));
const utapi = new UTApi({
  token: process.env.UPLOADTHING_TOKEN,
});

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    console.log("[captured-image] request received");
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "No file uploaded" },
        { status: 400 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const localName = `${Date.now()}_${safeName}`;
    const localPath = join(LOCAL_IMAGE_DIR, localName);

    try {
      await mkdir(LOCAL_IMAGE_DIR, { recursive: true });
      await writeFile(localPath, buffer);
      console.log("[captured-image] saved to disk:", localPath);
    } catch (diskError) {
      console.warn("[captured-image] local save skipped:", diskError);
    }
    console.log(
      "[captured-image] uploadthing token present:",
      !!process.env.UPLOADTHING_TOKEN,
    );

    const utFile = new UTFile([buffer], localName, {
      type: file.type || "image/jpeg",
      lastModified: Date.now(),
    });

    console.log("[captured-image] uploading saved file to UploadThing:", {
      name: localName,
      size: buffer.length,
      type: file.type || "image/jpeg",
    });

    const uploaded = await utapi.uploadFiles(utFile);
    console.log("[captured-image] raw upload result:", uploaded);
    const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    const uploadData = first && "data" in first ? first.data : first;

    console.log("[captured-image] upload result:", first);
    console.log("[captured-image] upload data:", uploadData);

    return NextResponse.json({
      ok: true,
      localPath: process.platform === "win32" ? localPath : null,
      url: uploadData?.ufsUrl || uploadData?.url,
      fileKey: uploadData?.key,
    });
  } catch (error) {
    console.error("[captured-image] upload failed:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Upload failed",
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    );
  }
}
