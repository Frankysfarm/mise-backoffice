'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Map, Flame, ShieldCheck } from 'lucide-react';

/**
 * Phase 1719 — Liefergebiet-Auslastungs-Karte (Dispatch)
 *
 * Zonen-Grid (A/B/C/D) mit Farbintensität (Bestelldichte) + Hotspot-Badge
 * + Coverage-Score-Ring. Phase 1717/Phase 809 API: /api/delivery/admin/liefergebiet-auslastung.
 * 10-Min-Polling. Multi-Tenant via locationId prop.
 */

interface ZoneAuslastung {
  zone: string;
  name: string;
  aktiveBestellungen: number;
  kapazitaet: number;
  auslastungPct: number;
  status: 'ok' | 'hoch' | 'kritisch';
  aktiveFahrer: number;
}

interface ApiResponse {
  ok: boolean;
  zonen: ZoneAuslastung[];
  alarm: boolean;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const RING_R = 20;
const RING_CIRC = 2 * Math.PI * RING_R;

const ZONE_COLORS: Record<ZoneAuslastung['status'], string> = {
  ok:       'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700',
  hoch:     'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
  kritisch: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700',
};

const ZONE_TEXT: Record<ZoneAuslastung['status'], string> = {
  ok:       'text-emerald-700 dark:text-emerald-300',
  hoch:     'text-amber-700 dark:text-amber-300',
  kritisch: 'text-red-700 dark:text-red-300',
};

const ZONE_BAR: Record<ZoneAuslastung['status'], string> = {
  ok:       'bg-emerald-500',
  hoch:     'bg-amber-500',
  kritisch: 'bg-red-500',
};

function CoverageRing({ pct }: { pct: number }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const dash = (clampedPct / 100) * RING_CIRC;
  const color = clampedPct >= 80 ? '#10b981' : clampedPct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="48" height="48">
      <circle cx="24" cy="24" r={RING_R} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle cx="24" cy="24" r={RING_R} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${RING_CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)" />
      <text x="24" y="29" textAnchor="middle"
        style={{ fontSize: 11, fontWeight: 900, fill: color }}>
        {clampedPct}%
      </text>
    </svg>
  );
}

function buildMock(locationId: string): ApiResponse {
  const seed = (locationId.charCodeAt(0) ?? 65);
  const r = (base: number, range: number, s: number) =>
    Math.max(0, Math.round(base + ((seed * s) % range) - range / 2));
  const KAPA: Record<string, number> = { A: 5, B: 8, C: 6, D: 4 };
  const NAMEN: Record<string, string> = { A: 'Express', B: 'Standard', C: 'Weit', D: 'Außerhalb' };
  const zonen: ZoneAuslastung[] = ['A', 'B', 'C', 'D'].map((zone, i) => {
    const aktive = r(4, 8, i * 7 + 3);
    const kap = KAPA[zone] ?? 5;
    const pct = Math.round((aktive / kap) * 100);
    return {
      zone,
      name: NAMEN[zone] ?? zone,
      aktiveBestellungen: aktive,
      kapazitaet: kap,
      auslastungPct: pct,
      status: pct >= 120 ? 'kritisch' : pct >= 80 ? 'hoch' : 'ok',
      aktiveFahrer: r(2, 4, i * 11 + 5),
    };
  });
  return { ok: true, zonen, alarm: zonen.some(z => z.status === 'kritisch'), generatedAt: new Date().toISOString() };
}

export function DispatchPhase1719LiefergebietAuslastungsKarte({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error();
      const json = await res.json() as ApiResponse;
      setData(json);
    } catch {
      setData(buildMock(locationId));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 10 * 60_000);
    return () => clearInterval(id);
  }, [fetch_]);

  if (!locationId) return null;

  const zonen = data?.zonen ?? [];
  const coveragePct = zonen.length > 0
    ? Math.round(zonen.reduce((s, z) => s + Math.min(100, z.auslastungPct), 0) / zonen.length)
    : 0;
  const hotspotZonen = zonen.filter(z => z.status === 'kritisch');

  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-950/10 p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-300">
          <Map className="h-4 w-4" />
          Liefergebiet-Auslastung
          {data?.alarm && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">!</span>
          )}
          {loading && <span className="text-[10px] font-normal text-muted-foreground">aktualisiert…</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Coverage-Ring + Hotspots */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <CoverageRing pct={coveragePct} />
              <span className="text-[9px] text-muted-foreground mt-0.5">Auslastung</span>
            </div>
            <div className="flex-1 space-y-1">
              {hotspotZonen.length > 0 ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1.5">
                  <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-xs font-bold text-red-700 dark:text-red-300">
                    Hotspot: Zone {hotspotZonen.map(z => z.zone).join(', ')} kritisch
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Alle Zonen im grünen Bereich</span>
                </div>
              )}
              {error && (
                <p className="text-[10px] text-muted-foreground">Mock-Daten (kein Supabase)</p>
              )}
            </div>
          </div>

          {/* Zonen-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {zonen.map(z => {
              const barW = Math.min(100, z.auslastungPct);
              return (
                <div key={z.zone} className={cn('rounded-lg border p-2 space-y-1', ZONE_COLORS[z.status])}>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-bold', ZONE_TEXT[z.status])}>
                      Zone {z.zone} — {z.name}
                    </span>
                    {z.status === 'kritisch' && (
                      <Flame className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', ZONE_BAR[z.status])}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px]', ZONE_TEXT[z.status])}>
                      {z.aktiveBestellungen}/{z.kapazitaet} Bestellungen
                    </span>
                    <span className={cn('text-[10px] font-black tabular-nums', ZONE_TEXT[z.status])}>
                      {z.auslastungPct}%
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{z.aktiveFahrer} Fahrer aktiv</p>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Aktualisierung alle 10 Min · {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
      )}
    </div>
  );
}
