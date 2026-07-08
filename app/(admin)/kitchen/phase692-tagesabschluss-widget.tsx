'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, BarChart2, AlertTriangle } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface Bericht {
  datum: string;
  umsatz_gesamt: number;
  bestellungen_gesamt: number;
  lieferungen: number;
  abholungen: number;
  stornos: number;
  storno_rate_pct: number;
  touren_gesamt: number;
  avg_lieferzeit_min: number | null;
  sla_pct: number | null;
  top_artikel: Array<{ name: string; menge: number }>;
}

const MOCK: Bericht = {
  datum: new Date().toISOString().slice(0, 10),
  umsatz_gesamt: 847.5,
  bestellungen_gesamt: 38,
  lieferungen: 24,
  abholungen: 14,
  stornos: 3,
  storno_rate_pct: 8,
  touren_gesamt: 11,
  avg_lieferzeit_min: 32,
  sla_pct: 88,
  top_artikel: [
    { name: 'Margherita', menge: 12 },
    { name: 'Döner Box', menge: 9 },
    { name: 'Pommes', menge: 8 },
  ],
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-bold tabular-nums leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function KitchenPhase692TagesabschlussWidget({ locationId }: Props) {
  const [bericht, setBericht] = useState<Bericht | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setBericht(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/tagesabschluss-bericht?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setBericht(json.bericht ?? MOCK);
      } else {
        setBericht(MOCK);
      }
    } catch {
      setBericht(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const slaColor =
    bericht && bericht.sla_pct !== null
      ? bericht.sla_pct >= 85
        ? 'text-emerald-600 dark:text-emerald-400'
        : bericht.sla_pct >= 70
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400'
      : 'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-semibold">Tagesabschluss</span>
          {!loading && bericht && (
            <span className="text-xs text-muted-foreground">
              {bericht.bestellungen_gesamt} Bestellungen · {bericht.umsatz_gesamt.toFixed(0)} €
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {loading || !bericht ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Umsatz" value={`${bericht.umsatz_gesamt.toFixed(2)} €`} />
                <Stat label="Bestellungen" value={`${bericht.bestellungen_gesamt}`} sub={`${bericht.lieferungen} Lief · ${bericht.abholungen} Abh`} />
                <Stat label="Touren" value={`${bericht.touren_gesamt}`} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="SLA-Pünktlichkeit"
                  value={bericht.sla_pct !== null ? `${bericht.sla_pct}%` : '—'}
                />
                <Stat
                  label="Ø Lieferzeit"
                  value={bericht.avg_lieferzeit_min !== null ? `${bericht.avg_lieferzeit_min} min` : '—'}
                />
                <Stat
                  label="Storno-Rate"
                  value={`${bericht.storno_rate_pct}%`}
                  sub={`${bericht.stornos} Stornos`}
                />
              </div>
              {bericht.sla_pct !== null && bericht.sla_pct < 85 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    SLA-Pünktlichkeit unter Ziel (85%) — Küchen-Timing prüfen.
                  </p>
                </div>
              )}
              {bericht.sla_pct !== null && bericht.sla_pct >= 85 && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/10 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    SLA-Ziel heute erreicht ({bericht.sla_pct}%) — Gute Arbeit!
                  </p>
                </div>
              )}
              {bericht.top_artikel.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Top-Artikel heute</p>
                  <div className="space-y-1">
                    {bericht.top_artikel.map((a, i) => (
                      <div key={a.name} className="flex items-center justify-between">
                        <span className="text-xs">
                          <span className="text-muted-foreground mr-1">{i + 1}.</span>
                          {a.name}
                        </span>
                        <span className="text-xs font-semibold tabular-nums">{a.menge}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
