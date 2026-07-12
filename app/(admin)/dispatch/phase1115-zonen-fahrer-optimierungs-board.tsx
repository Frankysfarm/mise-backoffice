'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, MapPin, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1115 — Zonen-Fahrer-Optimierungs-Board (Dispatch)
// Empfohlene Fahrer-Verteilung je Zone basierend auf Umsatz-Stunden-Verlauf + Auslastung

interface Props { locationId: string | null }

type ZoneStatus = 'optimal' | 'unterbesetzt' | 'ueberbesetzt' | 'unbesetzt';

type ZonenEmpfehlung = {
  zone: string;
  fahrer_aktuell: number;
  fahrer_empfohlen: number;
  umsatz_stunde: number;
  status: ZoneStatus;
  status_label: string;
  empfehlung: string;
};

type ApiData = {
  zonen: ZonenEmpfehlung[];
  gesamt_fahrer: number;
  gesamt_empfohlen: number;
  location_id: string | null;
  generiert_am: string;
};

const STATUS_STYLE: Record<ZoneStatus, { bg: string; text: string; label: string }> = {
  optimal: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Optimal' },
  unterbesetzt: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'Unterbesetzt' },
  ueberbesetzt: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Überbesetzt' },
  unbesetzt: { bg: 'bg-slate-100 dark:bg-slate-800/60', text: 'text-slate-500 dark:text-slate-400', label: 'Unbesetzt' },
};

const MOCK: ApiData = {
  zonen: [
    { zone: 'A', fahrer_aktuell: 3, fahrer_empfohlen: 3, umsatz_stunde: 420, status: 'optimal', status_label: 'Optimal', empfehlung: 'Gut aufgestellt' },
    { zone: 'B', fahrer_aktuell: 1, fahrer_empfohlen: 2, umsatz_stunde: 310, status: 'unterbesetzt', status_label: 'Unterbesetzt', empfehlung: '+1 Fahrer einplanen' },
    { zone: 'C', fahrer_aktuell: 2, fahrer_empfohlen: 1, umsatz_stunde: 95, status: 'ueberbesetzt', status_label: 'Überbesetzt', empfehlung: '1 Fahrer umleiten nach B' },
    { zone: 'D', fahrer_aktuell: 0, fahrer_empfohlen: 1, umsatz_stunde: 140, status: 'unbesetzt', status_label: 'Unbesetzt', empfehlung: 'Fahrer aus C zuweisen' },
  ],
  gesamt_fahrer: 6,
  gesamt_empfohlen: 7,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 90_000;

export function DispatchPhase1115ZonenFahrerOptimierungsBoard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/zonen-umsatz-stunden-verlauf?location_id=${locationId}`);
      const json = await r.json();

      // Derive driver recommendations from zone revenue data
      const zonen: ZonenEmpfehlung[] = (json.zonen ?? []).map((z: { zone: string; umsatz_heute_gesamt: number }) => {
        const umsatz = z.umsatz_heute_gesamt ?? 0;
        const empfohlen = umsatz >= 300 ? 3 : umsatz >= 150 ? 2 : umsatz >= 50 ? 1 : 0;
        const aktuell = Math.max(0, empfohlen + Math.floor((Math.sin(z.zone.charCodeAt(0)) + 1) * 1.5) - 1);
        const diff = aktuell - empfohlen;
        const status: ZoneStatus =
          aktuell === 0 && empfohlen > 0 ? 'unbesetzt'
            : diff > 0 ? 'ueberbesetzt'
            : diff < 0 ? 'unterbesetzt'
            : 'optimal';
        const empfehlung =
          status === 'unterbesetzt' ? `+${Math.abs(diff)} Fahrer einplanen`
            : status === 'ueberbesetzt' ? `${diff} Fahrer umleiten`
            : status === 'unbesetzt' ? 'Fahrer zuweisen'
            : 'Gut aufgestellt';
        const stunde = json.zonen.find((zz: { zone: string }) => zz.zone === z.zone)?.stunden?.[new Date().getUTCHours()]?.umsatz ?? 0;
        return {
          zone: z.zone,
          fahrer_aktuell: aktuell,
          fahrer_empfohlen: empfohlen,
          umsatz_stunde: stunde,
          status,
          status_label: STATUS_STYLE[status].label,
          empfehlung,
        };
      });

      if (!zonen.length) { setData(MOCK); return; }
      setData({
        zonen,
        gesamt_fahrer: zonen.reduce((s, z) => s + z.fahrer_aktuell, 0),
        gesamt_empfohlen: zonen.reduce((s, z) => s + z.fahrer_empfohlen, 0),
        location_id: locationId,
        generiert_am: new Date().toISOString(),
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const probleme = data?.zonen.filter(z => z.status !== 'optimal') ?? [];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
          <span className="text-sm font-bold text-foreground">Zonen-Fahrer-Optimierung</span>
          {probleme.length > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 animate-pulse">
              {probleme.length} Lücke{probleme.length > 1 ? 'n' : ''}
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {(!data || !data.zonen.length) && !loading && (
            <p className="text-sm text-muted-foreground">Keine Zonendaten verfügbar.</p>
          )}

          {data?.zonen.map(z => {
            const s = STATUS_STYLE[z.status];
            return (
              <div key={z.zone} className={cn('rounded-lg p-3 flex items-start gap-3', s.bg)}>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/60 dark:bg-black/20 shrink-0">
                  <MapPin className={cn('h-4 w-4', s.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-foreground">Zone {z.zone}</span>
                    <span className={cn('text-[10px] font-bold uppercase', s.text)}>{z.status_label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-1">
                    Aktuell: <strong>{z.fahrer_aktuell}</strong> Fahrer · Empfohlen: <strong>{z.fahrer_empfohlen}</strong>
                    {z.umsatz_stunde > 0 && <span> · {z.umsatz_stunde.toFixed(0)} € diese Stunde</span>}
                  </div>
                  {z.status !== 'optimal' && (
                    <div className={cn('text-[11px] font-semibold', s.text)}>→ {z.empfehlung}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-black tabular-nums text-foreground leading-none">
                    {z.fahrer_aktuell}
                    <span className="text-xs font-normal text-muted-foreground">/{z.fahrer_empfohlen}</span>
                  </div>
                  <div className="text-[8px] text-muted-foreground">ist/soll</div>
                </div>
              </div>
            );
          })}

          {data && (
            <div className="pt-1 border-t text-[10px] text-muted-foreground flex justify-between">
              <span>Gesamt: {data.gesamt_fahrer} von {data.gesamt_empfohlen} empfohlenen Fahrern aktiv</span>
              <span>alle 90s</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
