export function normalizeNin(value?: string | null): string | null {
  if (!value) return null;

  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

export function isValidNin(value?: string | null): boolean {
  const normalized = normalizeNin(value);
  if (!normalized) return false;
  return /^(CM|CF)[A-Z0-9]{12}$/.test(normalized);
}
