import { headers } from "next/headers";

/**
 * Server-side fetch that forwards the current request's cookie so the
 * API route can authenticate via the existing session.
 */
export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    const headersList = await headers();
    const cookie = headersList.get("cookie") || "";
    const host = headersList.get("host") || "localhost:3000";
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

    const response = await fetch(`${protocol}://${host}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        cookie,
        ...((init?.headers as Record<string, string>) || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return response;
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Internal fetch failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
