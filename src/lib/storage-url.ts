const STORAGE_BASE =
  process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, "") ||
  "https://app.schepen-kring.nl/storage";

/**
 * Resolves a storage path to a full URL.
 * - If already a full URL (http/https), returns as-is.
 * - Otherwise prepends NEXT_PUBLIC_STORAGE_URL from env.
 */
export function getStorageUrl(path: string | null | undefined): string {
  if (!path) return "";
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${STORAGE_BASE}/${trimmed.replace(/^\//, "")}`;
}
