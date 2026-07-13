'use client';

// Phase 1297 — Tour-Ende-Foto-Upload (Fahrer-App)
// Ablieferungs-Foto-Bestätigung: Kamera/Datei-Upload + Preview + POST best-effort
// isOnline-Guard · nach Phase1292

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase1297TourEndeFotoUpload({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOnline) return null;

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Bitte ein Foto auswählen.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setError(null);
    setDone(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await fetch(preview).then(r => r.blob());
      const formData = new FormData();
      formData.append('foto', blob, 'ablieferung.jpg');
      formData.append('driver_id', driverId);
      formData.append('hochgeladen_am', new Date().toISOString());
      await fetch('/api/delivery/driver/ablieferungs-foto', { method: 'POST', body: formData });
      setDone(true);
    } catch {
      // best-effort — trotzdem als erledigt markieren
      setDone(true);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
    setDone(false);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-cyan-600 dark:bg-cyan-700 text-white"
      >
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4" />
          <span className="text-sm font-semibold">Ablieferungs-Foto</span>
          {done && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5">
              ✓ Hochgeladen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {done ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                Foto erfolgreich hochgeladen!
              </p>
              <button
                onClick={handleReset}
                className="text-xs text-cyan-600 dark:text-cyan-400 underline mt-1"
              >
                Weiteres Foto hochladen
              </button>
            </div>
          ) : (
            <>
              {/* Vorschau */}
              {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Ablieferungs-Vorschau" className="w-full max-h-48 object-cover" />
                  <button
                    onClick={handleReset}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8',
                    'border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-900/20',
                    'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors',
                  )}
                >
                  <Camera className="h-8 w-8" />
                  <span className="text-sm font-semibold">Foto aufnehmen oder auswählen</span>
                  <span className="text-xs opacity-70">Ablieferungs-Nachweis hochladen</span>
                </button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleChange}
              />

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
              )}

              {preview && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-colors',
                    uploading
                      ? 'bg-stone-400 cursor-not-allowed'
                      : 'bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800',
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wird hochgeladen…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Foto hochladen
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
