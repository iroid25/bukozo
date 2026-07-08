import { headers } from "next/headers";

/**
 * Server-side fetch that forwards the current request's cookie so the
 * API route can authenticate via the existing session.
 */
export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const headersList = await headers();
  const cookie = headersList.get("cookie") || "";
  const host = headersList.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  return fetch(`${protocol}://${host}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...((init?.headers as Record<string, string>) || {}),
    },
    cache: "no-store",
  });
}
