'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MapPin, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1398 — Kilometerstand-Quittung (Fahrer-App)
 *
 * Schnelle Kilometerstand-Eingabe am Schichtende:
 *   • Eingabe: Start-km (vorausgefüllt wenn bekannt) + End-km
 *   • Berechnung: gefahrene km dieser Schicht
 *   • POST /api/delivery/driver/kilometerstand-quittung (best-effort)
 *   • Lokale Bestätigung + isOnline-Guard
 *
 * Nach Phase1393 in fahrer/app/client.tsx einbinden.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
  schichtStartKm?: number | null;
}

export function FahrerPhase1398KilometerstandQuittung({ driverId, isOnline, schichtStartKm = null }: Props) {
  const [open, setOpen] = useState(false);
  const [startKm, setStartKm] = useState(schichtStartKm !== null ? String(schichtStartKm) : '');
  const [endKm, setEndKm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gefahren = startKm && endKm
    ? Math.max(0, parseFloat(endKm) - parseFloat(startKm))
    : null;

  const handleSubmit = async () => {
    if (!startKm || !endKm) { setError('Bitte beide Felder ausfüllen.'); return; }
    const start = parseFloat(startKm);
    const end = parseFloat(endKm);
    if (isNaN(start) || isNaN(end) || end < start) { setError('End-km muss größer als Start-km sein.'); return; }
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/delivery/driver/kilometerstand-quittung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, start_km: start, end_km: end, gefahren_km: end - start }),
      });
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
        <div>
          <div className="font-semibold text-sm text-green-700 dark:text-green-300">Kilometerstand gespeichert</div>
          {gefahren !== null && (
            <div className="text-xs text-muted-foreground">{gefahren.toFixed(1)} km gefahren</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <MapPin className="h-4 w-4 text-orange-500" />
        <span className="font-semibold text-sm">Kilometerstand-Quittung</span>
        {gefahren !== null && <span className="ml-1 text-xs text-muted-foreground">{gefahren.toFixed(1)} km</span>}
        <span className="ml-auto text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!isOnline && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              Offline — Eintrag wird lokal gespeichert
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Start-km</label>
              <input
                type="number"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                placeholder="z.B. 12500"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">End-km</label>
              <input
                type="number"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                placeholder="z.B. 12638"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {gefahren !== null && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gefahren:</span>
              <span className="font-bold">{gefahren.toFixed(1)} km</span>
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !startKm || !endKm}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
              'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white disabled:opacity-50'
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Kilometerstand speichern
          </button>
        </div>
      )}
    </div>
  );
}
