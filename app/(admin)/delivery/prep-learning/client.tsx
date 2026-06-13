'use client';
import { useEffect, useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PrepProfile {
  hourBucket: number;
  bucketLabel: string;
  observations: number;
  meanPrepMin: number;
  p75PrepMin: number;
  p90PrepMin: number;
  stddevMin: number;
  avgDeltaMin: number;
  accuracyPct: number;
}

interface PrepAccuracySummary {
  locationId: string;
  totalObservations: number;
  avgActualMin: number;
  avgEstimatedMin: number;
  avgDeltaMin: number;
  stddevMin: number;
  p75Min: number;
  p90Min: number;
  accuracyPct: number;
  lastObservationAt: string | null;
}

interface PrepOutlier {
  orderId: string;
  bestellnummer: string | null;
  estimatedPrepMin: number;
  actualPrepMin: number;
  deltaMin: number;
  hourOfDay: number;
  dayOfWeek: number;
  itemCount: number;
  recordedAt: string;
}

interface Dashboard {
  summary: PrepAccuracySummary | null;
  profiles: PrepProfile[];
  outliers: PrepOutlier[];
  currentEstimate: number;
  defaultFallback: number;
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function formatMin(min: number): string {
  return `${Math.round(min)} Min`;
}

function deltaColor(delta: number): string {
  if (delta > 5) return 'text-red-600';
  if (delta > 2) return 'text-amber-600';
  if (delta < -2) return 'text-blue-600';
  return 'text-green-600';
}

function accuracyColor(pct: number): string {
  if (pct >= 70) return 'text-green-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function AccuracyBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PrepLearningClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/prep-learning');
      if (!res.ok) return;
      setData(await res.json());
      setLastUpdated(new Date().toLocaleTimeString('de-DE'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await fetch('/api/delivery/admin/prep-learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recompute' }),
      });
      await load();
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground animate-pulse">
        Küchen-Lernkurve wird geladen…
      </div>
    );
  }

  const s = data?.summary;
  const profiles = data?.profiles ?? [];
  const outliers = data?.outliers ?? [];
  const currentEstimate = data?.currentEstimate ?? 15;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Küchen-Lernkurve</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Echte Zubereitungszeiten vs. Schätzwerte — lernt automatisch aus jeder Bestellung.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Zuletzt: {lastUpdated}</span>
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="px-3 py-1.5 text-xs rounded-lg bg-matcha-600 text-white hover:bg-matcha-700 disabled:opacity-50 transition-colors"
          >
            {recomputing ? 'Berechnet…' : 'Neu berechnen'}
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Beobachtungen (30d)"
          value={s ? s.totalObservations.toLocaleString('de-DE') : '—'}
          sub={s ? `Ø Ist-Zeit: ${s.avgActualMin} Min` : 'Noch keine Daten'}
        />
        <KpiCard
          label="Ø Abweichung"
          value={s ? `${s.avgDeltaMin > 0 ? '+' : ''}${s.avgDeltaMin} Min` : '—'}
          sub={s && s.avgDeltaMin > 2 ? 'Systematisch unterschätzt' : s && s.avgDeltaMin < -2 ? 'Systematisch überschätzt' : 'Gut kalibriert'}
          valueColor={s ? deltaColor(s.avgDeltaMin) : ''}
        />
        <KpiCard
          label="Genauigkeit (±3 Min)"
          value={s ? `${s.accuracyPct} %` : '—'}
          sub={s ? `p75: ${s.p75Min} Min | p90: ${s.p90Min} Min` : '—'}
          valueColor={s ? accuracyColor(s.accuracyPct) : ''}
        />
        <KpiCard
          label="Aktueller Schätzwert"
          value={`${currentEstimate} Min`}
          sub="Gelernter p75 dieser Stunde"
          valueColor="text-matcha-700"
        />
      </div>

      {/* Stunden-Bucket-Profile */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Tageszeit-Profile</h2>
        {profiles.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-muted-foreground text-center">
            Noch keine Daten. Profile werden täglich um 02:00 Uhr neu berechnet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <BucketCard key={p.hourBucket} profile={p} />
            ))}
          </div>
        )}
      </section>

      {/* Ausreißer */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Ausreißer letzte 7 Tage
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (|Abweichung| &gt; 8 Min)
          </span>
        </h2>
        {outliers.length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-muted-foreground text-center">
            Keine Ausreißer in den letzten 7 Tagen — gute Kalibrierung!
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Bestellung</th>
                  <th className="px-3 py-2 text-right">Geschätzt</th>
                  <th className="px-3 py-2 text-right">Ist</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2 text-left">Zeit</th>
                  <th className="px-3 py-2 text-left">Tag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {outliers.map((o) => (
                  <tr key={o.orderId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">
                      {o.bestellnummer ?? o.orderId.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatMin(o.estimatedPrepMin)}</td>
                    <td className="px-3 py-2 text-right">{formatMin(o.actualPrepMin)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${deltaColor(o.deltaMin)}`}>
                      {o.deltaMin > 0 ? '+' : ''}{Math.round(o.deltaMin)} Min
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{o.hourOfDay}:00</td>
                    <td className="px-3 py-2 text-muted-foreground">{DAY_LABELS[o.dayOfWeek]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Info-Box */}
      <section className="rounded-xl border border-matcha-200 bg-matcha-50/40 p-4 text-sm space-y-2">
        <p className="font-semibold text-matcha-800">So funktioniert die Lernkurve</p>
        <ul className="space-y-1 text-muted-foreground list-disc list-inside">
          <li>Wenn die Küche &quot;Fertig&quot; klickt, wird die echte Zubereitungszeit aufgezeichnet.</li>
          <li>Das System berechnet täglich p75- und p90-Werte je Tageszeit-Bucket.</li>
          <li>Der p75-Wert wird als neuer Schätzwert für den Dispatch verwendet (in 75% pünktlich fertig).</li>
          <li>Ausreißer mit &gt;8 Min Abweichung erscheinen hier zur manuellen Überprüfung.</li>
          <li>Mindestens 5 Beobachtungen pro Bucket nötig, bevor der Lernwert aktiv ist.</li>
        </ul>
      </section>
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueColor = '',
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function BucketCard({ profile: p }: { profile: PrepProfile }) {
  const isActive = p.observations >= 5;
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${isActive ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{p.bucketLabel}</span>
        <span className="text-xs text-muted-foreground">{p.observations} Obs.</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div className="font-bold text-sm">{isActive ? formatMin(p.meanPrepMin) : '—'}</div>
          <div className="text-muted-foreground">Ø</div>
        </div>
        <div>
          <div className="font-bold text-sm text-matcha-700">{isActive ? formatMin(p.p75PrepMin) : '—'}</div>
          <div className="text-muted-foreground">p75 ⭐</div>
        </div>
        <div>
          <div className="font-bold text-sm">{isActive ? formatMin(p.p90PrepMin) : '—'}</div>
          <div className="text-muted-foreground">p90</div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-muted-foreground">Genauigkeit (±3 Min)</span>
          <span className={accuracyColor(p.accuracyPct)}>{isActive ? `${p.accuracyPct}%` : '—'}</span>
        </div>
        {isActive && <AccuracyBar pct={p.accuracyPct} />}
      </div>
      {isActive && (
        <div className={`text-xs ${deltaColor(p.avgDeltaMin)}`}>
          Ø Δ: {p.avgDeltaMin > 0 ? '+' : ''}{p.avgDeltaMin} Min
          {Math.abs(p.avgDeltaMin) > 3 && (
            <span className="ml-1 text-muted-foreground">
              {p.avgDeltaMin > 3 ? '→ Schätzung erhöhen' : '→ Schätzung senken'}
            </span>
          )}
        </div>
      )}
      {!isActive && (
        <div className="text-xs text-muted-foreground">Zu wenig Daten (&lt;5 Beobachtungen)</div>
      )}
    </div>
  );
}
