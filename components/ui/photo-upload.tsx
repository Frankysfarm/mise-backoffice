'use client';

import * as React from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type Props = {
  bucket: string;
  path: (file: File) => string;
  currentUrl?: string | null;
  onUploaded: (path: string, publicUrl: string) => void | Promise<void>;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  isPublicBucket?: boolean;
  className?: string;
};

export function PhotoUpload({
  bucket, path, currentUrl, onUploaded,
  label = 'Bild hochladen', accept = 'image/*', maxSizeMB = 10,
  isPublicBucket = false, className,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(currentUrl ?? null);

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toastError('Datei zu groß', `Max. ${maxSizeMB} MB.`);
      return;
    }

    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      const sb = createClient();
      const storagePath = path(file);
      const { error } = await sb.storage.from(bucket).upload(storagePath, file, {
        upsert: true, contentType: file.type,
      });
      if (error) throw error;

      let publicUrl = '';
      if (isPublicBucket) {
        const { data } = sb.storage.from(bucket).getPublicUrl(storagePath);
        publicUrl = data.publicUrl;
      } else {
        const { data } = await sb.storage.from(bucket).createSignedUrl(storagePath, 3600);
        publicUrl = data?.signedUrl ?? '';
      }
      setPreview(publicUrl);
      await onUploaded(storagePath, publicUrl);
      toastSuccess('Hochgeladen', file.name);
    } catch (e: any) {
      toastError('Upload fehlgeschlagen', e?.message ?? 'unbekannter Fehler');
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = ''; // allow re-upload same file
  }

  function clear() {
    setPreview(null);
    void onUploaded('', '');
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        className="hidden"
      />

      {preview ? (
        <div className="relative group rounded-lg overflow-hidden border bg-card w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="block h-32 w-32 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full bg-white/90 p-2 text-matcha-800 hover:bg-white transition">
              <Upload className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={uploading}
              className="rounded-full bg-white/90 p-2 text-destructive hover:bg-white transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground hover:border-matcha-500 hover:text-matcha-700 transition">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{label}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
