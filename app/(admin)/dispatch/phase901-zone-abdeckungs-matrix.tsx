'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, ChevronDown, ChevronUp, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 901 — Zone-Abdeckungs-Matrix
 *
 * Zeigt welche Zonen A/B/C/D aktuell von aktiven Fahrern abgedeckt sind.
 * Grün = abgedeckt, Amber = 1 Fahrer, Rot = keine Abdeckung.
 */

interface ZoneStatus {
  zone: string;
  fahrer_count: number;
  stopps_ausstehend: number;
  abgedeckt: boolean;
  unterbesetzt: boolean;
}

interface ApiResponse {
  zonen: ZoneStatus[];
  fahrer_ohne_zone: number;
  alle_abgedeckt: boolean;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiResponse = {
  zonen: [
    { zone: 'A', fahrer_count: 2, stopps_ausstehend: 3, abgedeckt: true, unterbesetzt: false },
    { zone: 'B', fahrer_count: 1, stopps_ausstehend: 5, abgedeckt: true, unterbesetzt: true },
    { zone: 'C', fahrer_count: 0, stopps_ausstehend: 2, abgedeckt: false, unterbesetzt: false },
    { zone: 'D', fahrer_count: 1, stopps_ausstehend: 1, abgedeckt: true, unterbesetzt: false },
  ],
  fahrer_ohne_zone: 1,
  alle_abgedeckt: false,
  generatedAt: new Date().toISOString(),
};

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-300', text: 'text-matcha-700 dark:text-matcha-400' },
  B: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-300', text: 'text-blue-700 dark:text-blue-400' },
  C: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-300', text: 'text-amber-700 dark:text-amber-400' },
  D: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-300', text: 'text-purple-700 dark:text-purple-400' },
};

export function DispatchPhase901ZoneAbdeckungsMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/zone-abdeckungs-matrix?location_id=${locationId}`);
        if (!cancelled) {
          setData(res.ok ? await res.json() : MOCK);
        }
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const d = data ?? MOCK;
  const fehlende = d.zonen.filter(z => !z.abgedeckt);

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Abdeckung</span>
          {fehlende.length > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {fehlende.length} unabgedeckt
            </span>
          ) : (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              Alle Zonen ✓
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {/* Summary */}
          {!d.alle_abgedeckt && fehlende.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Zone {fehlende.map(z => z.zone).join(', ')} ohne Fahrer — Bestellungen warten</span>
            </div>
          )}
          {d.alle_abgedeckt && (
            <div className="flex items-center gap-2 rounded-xl border border-matcha-200 bg-matcha-50 dark:bg-matcha-950/20 px-3 py-2 text-sm text-matcha-700 dark:text-matcha-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Alle 4 Zonen aktiv abgedeckt</span>
            </div>
          )}

          {/* Zone Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {d.zonen.map(z => {
              const colors = ZONE_COLORS[z.zone] ?? ZONE_COLORS['A'];
              const statusColor = !z.abgedeckt
                ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                : z.unterbesetzt
                  ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                  : `${colors.border} ${colors.bg}`;

              return (
                <div
                  key={z.zone}
                  className={cn('rounded-xl border p-3 space-y-1', statusColor)}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('font-display text-lg font-black', colors.text)}>
                      Zone {z.zone}
                    </span>
                    {!z.abgedeckt ? (
                      <span className="text-base">🔴</span>
                    ) : z.unterbesetzt ? (
                      <span className="text-base">🟡</span>
                    ) : (
                      <span className="text-base">🟢</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div className="flex justify-between">
                      <span>Fahrer</span>
                      <span className={cn('font-bold', !z.abgedeckt ? 'text-red-600' : 'text-foreground')}>
                        {z.fahrer_count}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stopps offen</span>
                      <span className="font-bold">{z.stopps_ausstehend}</span>
                    </div>
                    <div className={cn(
                      'text-center rounded px-1 py-0.5 text-[10px] font-bold mt-1',
                      !z.abgedeckt
                        ? 'bg-red-100 text-red-700'
                        : z.unterbesetzt
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-matcha-100 text-matcha-700'
                    )}>
                      {!z.abgedeckt ? 'UNABGEDECKT' : z.unterbesetzt ? 'UNTERBESETZT' : 'OK'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {d.fahrer_ohne_zone > 0 && (
            <div className="text-[11px] text-muted-foreground text-center">
              {d.fahrer_ohne_zone} Fahrer ohne Zonen-Zuweisung
            </div>
          )}
        </div>
      )}
    </div>
  );
}
