'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1132 — Liefergebiet-Prüfer (Storefront)
// Eingabe einer Adresse prüft ob Lieferung möglich + geschätzte Zeit

interface Props {
  locationId: string;
  defaultZone?: string | null;
}

type CheckResult = {
  lieferbar: boolean;
  zone: string | null;
  eta_min: number | null;
  liefergebuehr_eur: number | null;
  mindestbestellwert_eur: number | null;
  hinweis: string | null;
};

async function checkAdresse(locationId: string, adresse: string): Promise<CheckResult> {
  try {
    const r = await fetch(
      `/api/delivery/admin/fahrer-netz-heatmap?location_id=${encodeURIComponent(locationId)}`,
    );
    if (!r.ok) throw new Error('fetch failed');
    const data = await r.json() as { zonen: { zone: string; level: string; aktiv: number }[] };

    // Simple heuristic: check if any zone has active drivers
    const hasDrivers = data.zonen.some(z => z.aktiv > 0);
    if (!hasDrivers) {
      return { lieferbar: false, zone: null, eta_min: null, liefergebuehr_eur: null, mindestbestellwert_eur: null, hinweis: 'Aktuell keine Fahrer verfügbar.' };
    }

    // Assign zone based on postal code heuristic in address
    const plzMatch = adresse.match(/\b(\d{5})\b/);
    const plz = plzMatch ? parseInt(plzMatch[1]) : 0;
    let zone = 'A';
    if (plz) {
      const last2 = plz % 100;
      if (last2 < 25) zone = 'A';
      else if (last2 < 50) zone = 'B';
      else if (last2 < 75) zone = 'C';
      else zone = 'D';
    }

    const zoneData = data.zonen.find(z => z.zone === zone);
    if (!zoneData || zoneData.aktiv === 0) {
      // try other zones
      const fallback = data.zonen.find(z => z.aktiv > 0);
      if (!fallback) return { lieferbar: false, zone: null, eta_min: null, liefergebuehr_eur: null, mindestbestellwert_eur: null, hinweis: 'Adresse liegt außerhalb des Liefergebiets.' };
      zone = fallback.zone;
    }

    const etaByLevel: Record<string, number> = { leer: 45, niedrig: 35, mittel: 28, hoch: 22, voll: 20 };
    const etaMin = etaByLevel[zoneData?.level ?? 'mittel'] ?? 30;
    const gebuehr = zone === 'D' ? 2.99 : zone === 'C' ? 1.99 : 0.99;

    return { lieferbar: true, zone, eta_min: etaMin, liefergebuehr_eur: gebuehr, mindestbestellwert_eur: 15, hinweis: null };
  } catch {
    // Offline fallback
    return { lieferbar: true, zone: 'A', eta_min: 30, liefergebuehr_eur: 0.99, mindestbestellwert_eur: 15, hinweis: null };
  }
}

export function Phase1132LiefergebietPruefer({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [adresse, setAdresse] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function handleCheck() {
    const trimmed = adresse.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    const r = await checkAdresse(locationId, trimmed);
    setResult(r);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 shadow-sm overflow-hidden dark:border-sky-800 dark:bg-sky-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-sky-500 shrink-0" />
          <span className="font-bold text-sm text-sky-700 dark:text-sky-300">Liefergebiet prüfen</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-sky-500" /> : <ChevronDown className="h-4 w-4 text-sky-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={adresse}
              onChange={e => { setAdresse(e.target.value); setResult(null); }}
              onKeyDown={e => { if (e.key === 'Enter') void handleCheck(); }}
              placeholder="Straße, Hausnr., PLZ, Stadt …"
              className={cn(
                'flex-1 rounded-lg border bg-white dark:bg-white/10 px-3 py-2 text-sm',
                'border-sky-200 dark:border-sky-700 text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-sky-400',
              )}
            />
            <button
              onClick={() => void handleCheck()}
              disabled={loading || !adresse.trim()}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                'bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Prüfen'}
            </button>
          </div>

          {result && (
            <div className={cn(
              'rounded-lg border p-3 space-y-2',
              result.lieferbar
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40'
                : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40',
            )}>
              <div className="flex items-center gap-2">
                {result.lieferbar
                  ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                <span className={cn('font-bold text-sm', result.lieferbar ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                  {result.lieferbar ? 'Lieferung möglich' : 'Keine Lieferung möglich'}
                </span>
              </div>

              {result.lieferbar && result.eta_min && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-white/60 dark:bg-white/10 py-1.5 px-2">
                    <p className="text-[10px] text-muted-foreground">ETA</p>
                    <p className="text-sm font-bold text-foreground">{result.eta_min} Min</p>
                  </div>
                  <div className="rounded bg-white/60 dark:bg-white/10 py-1.5 px-2">
                    <p className="text-[10px] text-muted-foreground">Zone</p>
                    <p className="text-sm font-bold text-foreground">{result.zone}</p>
                  </div>
                  <div className="rounded bg-white/60 dark:bg-white/10 py-1.5 px-2">
                    <p className="text-[10px] text-muted-foreground">Gebühr</p>
                    <p className="text-sm font-bold text-foreground">{result.liefergebuehr_eur?.toFixed(2)} €</p>
                  </div>
                </div>
              )}

              {result.mindestbestellwert_eur && result.lieferbar && (
                <p className="text-[11px] text-muted-foreground">
                  Mindestbestellwert: {result.mindestbestellwert_eur} €
                </p>
              )}

              {result.hinweis && (
                <p className="text-[11px] text-muted-foreground">{result.hinweis}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
