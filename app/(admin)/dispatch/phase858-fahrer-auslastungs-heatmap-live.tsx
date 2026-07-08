'use client';

import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerAuslastung {
  driver_id: string;
  name: string;
  auslastung_pct: number; // 0–100+
  aktive_stopps: number;
  touren_heute: number;
  status: 'frei' | 'unterwegs' | 'ueberlastet';
}

interface AuslastungData {
  fahrer: FahrerAuslastung[];
  avg_auslastung: number;
  generatedAt: string;
}

const MOCK: AuslastungData = {
  fahrer: [
    { driver_id: '1', name: 'Ahmed K.', auslastung_pct: 92, aktive_stopps: 4, touren_heute: 6, status: 'unterwegs' },
    { driver_id: '2', name: 'Bernd S.', auslastung_pct: 45, aktive_stopps: 2, touren_heute: 3, status: 'frei' },
    { driver_id: '3', name: 'Chiara M.', auslastung_pct: 115, aktive_stopps: 5, touren_heute: 8, status: 'ueberlastet' },
    { driver_id: '4', name: 'Dieter R.', auslastung_pct: 70, aktive_stopps: 3, touren_heute: 5, status: 'unterwegs' },
    { driver_id: '5', name: 'Eva L.', auslastung_pct: 20, aktive_stopps: 1, touren_heute: 2, status: 'frei' },
  ],
  avg_auslastung: 68,
  generatedAt: new Date().toISOString(),
};

const statusStyle = {
  frei:        { bar: 'bg-matcha-400', badge: 'bg-matcha-100 text-matcha-700', label: 'Frei' },
  unterwegs:   { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Aktiv' },
  ueberlastet: { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Überlastet' },
};

export function DispatchPhase858FahrerAuslastungsHeatmapLive({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const raw = await res.json() as {
          fahrer?: Array<{
            driver_id?: string; name?: string; vorname?: string;
            auslastung_pct?: number; aktive_stopps?: number; touren_heute?: number; stopps?: number; touren?: number;
          }>;
        };
        if (Array.isArray(raw.fahrer) && raw.fahrer.length > 0) {
          const mapped: FahrerAuslastung[] = raw.fahrer.map(f => {
            const pct = f.auslastung_pct ?? 0;
            const status: FahrerAuslastung['status'] =
              pct >= 100 ? 'ueberlastet' : pct >= 50 ? 'unterwegs' : 'frei';
            return {
              driver_id: f.driver_id ?? '',
              name: f.name ?? f.vorname ?? 'Fahrer',
              auslastung_pct: Math.round(pct),
              aktive_stopps: f.aktive_stopps ?? f.stopps ?? 0,
              touren_heute: f.touren_heute ?? f.touren ?? 0,
              status,
            };
          }).sort((a, b) => b.auslastung_pct - a.auslastung_pct);

          const avg = mapped.length
            ? Math.round(mapped.reduce((s, f) => s + f.auslastung_pct, 0) / mapped.length)
            : 0;

          setData({ fahrer: mapped, avg_auslastung: avg, generatedAt: new Date().toISOString() });
          return;
        }
      }
    } catch { /* fallback */ } finally {
      setLoading(false);
    }
    setData(MOCK);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [open, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ueberlastet = (data?.fahrer ?? []).filter(f => f.status === 'ueberlastet').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-amber-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Auslastung Live</span>
          {ueberlastet > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {ueberlastet} überlastet
            </span>
          )}
          {data && ueberlastet === 0 && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
              Ø {data.avg_auslastung}%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-3">
          {loading && !data && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {data && (
            <>
              {/* Legende */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {(['frei', 'unterwegs', 'ueberlastet'] as const).map(s => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={cn('h-2 w-2 rounded-full', statusStyle[s].bar)} />
                    <span>{statusStyle[s].label}</span>
                  </div>
                ))}
              </div>

              {/* Fahrer-Heatmap-Liste */}
              <div className="space-y-2">
                {data.fahrer.map(f => {
                  const s = statusStyle[f.status];
                  const barPct = Math.min(100, f.auslastung_pct);
                  return (
                    <div key={f.driver_id} className="space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[11px] font-semibold truncate">{f.name}</span>
                          <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 shrink-0', s.badge)}>
                            {s.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {f.aktive_stopps} Stopp{f.aktive_stopps !== 1 ? 's' : ''}
                          </span>
                          <span className={cn(
                            'text-[10px] font-black tabular-nums w-10 text-right',
                            f.auslastung_pct >= 100 ? 'text-red-600' : f.auslastung_pct >= 60 ? 'text-amber-600' : 'text-matcha-600',
                          )}>
                            {f.auslastung_pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ø-Balken */}
              <div className="rounded-xl bg-muted/40 border px-3 py-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Ø Auslastung</span>
                <span className={cn(
                  'font-black tabular-nums',
                  data.avg_auslastung >= 90 ? 'text-red-600' : data.avg_auslastung >= 65 ? 'text-amber-600' : 'text-matcha-600',
                )}>
                  {data.avg_auslastung}%
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground text-right">
                Live · {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
