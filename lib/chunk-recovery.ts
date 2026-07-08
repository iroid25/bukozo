export function isChunkLoadError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : `${(error as { message?: string } | null)?.message || ""} ${(error as { name?: string } | null)?.name || ""}`.toLowerCase();

  return (
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("failed to fetch dynamically imported module")
  );
}

export function reloadAfterChunkError() {
  if (typeof window === "undefined") return;

  const routeKey = `${window.location.pathname}${window.location.search}`;
  const reloadKey = `__next_chunk_reload_attempted__:${routeKey}`;

  if (sessionStorage.getItem(reloadKey) === "1") {
    return;
  }

  sessionStorage.setItem(reloadKey, "1");

  const url = new URL(window.location.href);
  url.searchParams.set("__chunk_retry", String(Date.now()));
  window.location.replace(url.toString());
}
