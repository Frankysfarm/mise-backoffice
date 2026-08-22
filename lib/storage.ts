import { createClient } from '@/lib/supabase/server';

/**
 * Gibt signierte Download-URLs für Storage-Objekte zurück (für nicht-öffentliche Buckets).
 * Läuft Server-side. URLs sind 1h gültig.
 */
export async function signUrls(bucket: string, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const clean = paths.filter((p): p is string => !!p);
  if (clean.length === 0) return result;

  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(clean, 3600);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) result.set(entry.path, entry.signedUrl);
  }
  return result;
}

/** Public URL für öffentliche Buckets (z.B. recipe-photos). */
export function publicUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
