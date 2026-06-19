'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { XCircle, TrendingDown, TrendingUp, RefreshCw, AlertTriangle, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface CancelledOrder {
  bestellnummer: string;
  grund: string | null;
  storniert_am: string;
  gesamtbetrag: number;
}

interface StornoDaten {
  heut_gesamt: number;
  heut_storniert: number;
  storno_quote: number;
  prev_quote: number;
  verlust_eur: number;
  gruende: { grund: string; count: number }[];
  verlauf: { stunde: string; storniert: number; gesamt: number }[];
  letzte_stornos: CancelledOrder[];
}

function euro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function StornoquotePanel({ locationId }: { locationId: string | null }) {
  const [daten, setDaten] = useState<StornoDaten | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/stats?location_id=${locationId}&action=storno_quote`);
      if (r.ok) {
        const d = await r.json();
        setDaten(d);
      } else {
        // Graceful fallback with mock structure
        setDaten({
          heut_gesamt: 0,
          heut_storniert: 0,
          storno_quote: 0,
          prev_quote: 0,
          verlust_eur: 0,
          gruende: [],
          verlauf: [],
          letzte_stornos: [],
        });
      }
    } catch {
      setDaten({
        heut_gesamt: 0,
        heut_storniert: 0,
        storno_quote: 0,
        prev_quote: 0,
        verlust_eur: 0,
        gruende: [],
        verlauf: [],
        letzte_stornos: [],
      });
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!locationId) return null;

  const quoteColor = daten
    ? daten.storno_quote < 5 ? 'text-matcha-600' : daten.storno_quote < 10 ? 'text-amber-600' : 'text-red-600'
    : 'text-muted-foreground';

  const trend = daten ? daten.storno_quote - daten.prev_quote : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition"
      >
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-bold text-sm flex-1 text-left">Stornoquote</span>
        {daten && (
          <div className="flex items-center gap-2">
            <span className={cn('font-black text-sm tabular-nums', quoteColor)}>
              {daten.storno_quote.toFixed(1)}%
            </span>
            {trend !== 0 && (
              trend > 0
                ? <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                : <TrendingDown className="h-3.5 w-3.5 text-matcha-500" />
            )}
          </div>
        )}
        {loading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
      </button>

      {open && daten && (
        <div className="border-t px-5 py-4 space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Storniert heute',
                value: daten.heut_storniert.toString(),
                sub: `von ${daten.heut_gesamt} Bestellungen`,
                color: daten.heut_storniert > 0 ? 'border-l-red-400' : 'border-l-matcha-400',
              },
              {
                label: 'Stornoquote',
                value: `${daten.storno_quote.toFixed(1)}%`,
                sub: trend === 0 ? 'vs. gestern ±0' : `${trend > 0 ? '+' : ''}${trend.toFixed(1)}% vs. gestern`,
                color: daten.storno_quote < 5 ? 'border-l-matcha-400' : daten.storno_quote < 10 ? 'border-l-amber-400' : 'border-l-red-400',
              },
              {
                label: 'Umsatz-Verlust',
                value: euro(daten.verlust_eur),
                sub: 'durch Stornos',
                color: daten.verlust_eur > 0 ? 'border-l-red-400' : 'border-l-gray-200',
              },
            ].map((kpi) => (
              <div key={kpi.label} className={cn('bg-muted/40 rounded-xl p-3 border-l-4', kpi.color)}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</div>
                <div className="text-xl font-black text-foreground tabular-nums mt-0.5">{kpi.value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Stündlicher Verlauf */}
          {daten.verlauf.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Stornos je Stunde
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={daten.verlauf} barSize={14}>
                  <XAxis dataKey="stunde" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, n) => [v, n === 'storniert' ? 'Storniert' : 'Gesamt']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="storniert" radius={3}>
                    {daten.verlauf.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.gesamt > 0 && entry.storniert / entry.gesamt > 0.1 ? '#ef4444' : '#f59e0b'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Storno-Gründe */}
          {daten.gruende.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Häufigste Storno-Gründe
              </div>
              <div className="space-y-1.5">
                {daten.gruende.slice(0, 5).map((g) => {
                  const pct = daten.heut_storniert > 0 ? (g.count / daten.heut_storniert) * 100 : 0;
                  return (
                    <div key={g.grund} className="flex items-center gap-2">
                      <div className="flex-1 text-xs text-foreground truncate">{g.grund || 'Unbekannt'}</div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-5 text-right">
                          {g.count}×
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Letzte Stornos */}
          {daten.letzte_stornos.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Zuletzt storniert
              </div>
              <div className="space-y-1">
                {daten.letzte_stornos.slice(0, 4).map((s) => (
                  <div key={s.bestellnummer} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                    <span className="text-xs font-bold">#{s.bestellnummer}</span>
                    <span className="flex-1 text-[10px] text-muted-foreground truncate">{s.grund || 'Kein Grund'}</span>
                    <span className="text-[10px] font-bold text-red-400 tabular-nums shrink-0">
                      -{euro(s.gesamtbetrag)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {daten.heut_storniert === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              🎉 Heute noch keine Stornos!
            </div>
          )}

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      )}
    </div>
  );
}
