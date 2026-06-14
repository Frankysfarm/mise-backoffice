'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Target } from 'lucide-react';

interface ZoneAccuracy {
  zone: string;
  vehicle: string;
  completedDeliveries: number;
  pendingDeliveries: number;
  onTimeRate: number;
  avgErrorMin: number;
  avgRelativeError: number;
}

interface CalibrationFactor {
  zone: string;
  vehicle: string;
  hourBucket: number;
  hourBucketLabel: string;
  factor: number;
  sampleCount: number;
  onTimeRate: number;
}

interface AccuracyReport {
  locationId: string;
  generatedAt: string;
  overall: {
    completedDeliveries: number;
    pendingDeliveries: number;
    onTimeRate: number;
    avgErrorMin: number;
  };
  byZone: ZoneAccuracy[];
  calibrationFactors: CalibrationFactor[];
  _fallback?: boolean;
}

function pctColor(rate: number) {
  if (rate >= 0.9) return 'text-matcha-700 bg-matcha-50 border-matcha-200';
  if (rate >= 0.75) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function factorColor(factor: number) {
  const deviation = Math.abs(factor - 1.0);
  if (deviation < 0.05) return 'text-matcha-700';
  if (deviation < 0.15) return 'text-amber-600';
  return 'text-red-600';
}

export function EtaAccuracyClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<AccuracyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  void locationId;

  const load = () => {
    setLoading(true);
    fetch('/api/delivery/admin/eta-accuracy')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.overall) setData(d as AccuracyReport); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const recalculate = async () => {
    setRecalculating(true);
    await fetch('/api/delivery/admin/eta-accuracy', { method: 'POST' });
    setRecalculating(false);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Aktionen */}
      <div className="flex items-center gap-2">
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
        <button
          onClick={recalculate}
          disabled={recalculating || loading}
          className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
        >
          <Target className="h-3.5 w-3.5" />
          {recalculating ? 'Wird neu berechnet…' : 'Kalibrierung neu berechnen'}
        </button>
        {data?.generatedAt && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Stand: {new Date(data.generatedAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade ETA-Bericht…</div>
      )}

      {!loading && data?._fallback && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Noch keine abgeschlossenen Lieferungen für die Kalibrierung.
        </div>
      )}

      {!loading && data && !data._fallback && (
        <>
          {/* Gesamt KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgeschlossen</div>
              <div className="font-display text-2xl font-black">{data.overall.completedDeliveries}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{data.overall.pendingDeliveries} ausstehend</div>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', pctColor(data.overall.onTimeRate))}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-current/60 mb-1">On-Time-Rate</div>
              <div className="font-display text-2xl font-black">{Math.round(data.overall.onTimeRate * 100)}%</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Fehler</div>
              <div className="font-display text-2xl font-black">
                {data.overall.avgErrorMin > 0 ? '+' : ''}{data.overall.avgErrorMin.toFixed(1)} Min
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">positiv = zu spät</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Faktoren</div>
              <div className="font-display text-2xl font-black">{data.calibrationFactors.length}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Kalibrierungspunkte</div>
            </div>
          </div>

          {/* Zone-Aufschlüsselung */}
          {data.byZone.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <span className="font-semibold text-sm">Genauigkeit nach Zone & Fahrzeug</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Zone</th>
                      <th className="text-left px-4 py-2">Fahrzeug</th>
                      <th className="text-left px-4 py-2">Lieferungen</th>
                      <th className="text-left px-4 py-2">On-Time</th>
                      <th className="text-left px-4 py-2">Ø Fehler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byZone.map((z, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2.5 text-sm font-medium">Zone {z.zone}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{z.vehicle}</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums">{z.completedDeliveries}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', pctColor(z.onTimeRate))}>
                            {Math.round(z.onTimeRate * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm tabular-nums">
                          <span className={z.avgErrorMin > 2 ? 'text-red-600 font-medium' : z.avgErrorMin < -2 ? 'text-matcha-600' : 'text-muted-foreground'}>
                            {z.avgErrorMin > 0 ? '+' : ''}{z.avgErrorMin.toFixed(1)} Min
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kalibrierungsfaktoren */}
          {data.calibrationFactors.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <span className="font-semibold text-sm">Kalibrierungsfaktoren</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Faktor &gt;1.0 = ETAs werden verlängert, &lt;1.0 = verkürzt</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Zone</th>
                      <th className="text-left px-4 py-2">Fahrzeug</th>
                      <th className="text-left px-4 py-2">Zeitfenster</th>
                      <th className="text-left px-4 py-2">Faktor</th>
                      <th className="text-left px-4 py-2">Stichproben</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.calibrationFactors
                      .sort((a, b) => Math.abs(b.factor - 1) - Math.abs(a.factor - 1))
                      .map((f, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-4 py-2.5 text-sm font-medium">Zone {f.zone}</td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground capitalize">{f.vehicle}</td>
                          <td className="px-4 py-2.5 text-sm text-muted-foreground">{f.hourBucketLabel}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('text-sm font-bold tabular-nums', factorColor(f.factor))}>
                              ×{f.factor.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{f.sampleCount}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
