'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Filter, ChevronDown, ChevronUp, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface TrichterSnapshot {
  id:                string;
  datum:             string;
  eingegangen:       number;
  inKueche:          number;
  unterwegs:         number;
  geliefert:         number;
  storniert:         number;
  umsatzEingegangen: number;
  umsatzGeliefert:   number;
  rateKueche:        number | null;
  rateTransit:       number | null;
  rateAbschluss:     number | null;
  rateGesamt:        number | null;
  avgLieferMin:      number | null;
  avgGesamtMin:      number | null;
}

function fmtPct(v: number | null) {
  if (v == null) return '—';
  return Math.round(v * 100) + '%';
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function rateColor(v: number | null) {
  if (v == null) return 'text-stone-400';
  if (v >= 0.85) return 'text-emerald-700';
  if (v >= 0.70) return 'text-amber-700';
  return 'text-rose-600';
}

function rateBg(v: number | null) {
  if (v == null) return 'bg-stone-100';
  if (v >= 0.85) return 'bg-emerald-500';
  if (v >= 0.70) return 'bg-amber-400';
  return 'bg-rose-500';
}

function TrichterStufe({
  label,
  count,
  total,
  rate,
  highlight,
}: {
  label:     string;
  count:     number;
  total:     number;
  rate:      number | null;
  highlight: boolean;
}) {
  const pct = total > 0 ? count / total : 0;
  return (
    <div className={`relative flex items-center gap-3 p-3 rounded-xl ${highlight ? 'bg-teal-50 border border-teal-100' : 'bg-stone-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-stone-500 mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-stone-900 tabular-nums">{count}</span>
          {total > 0 && (
            <span className="text-xs text-stone-400">
              ({Math.round(pct * 100)}% von {total})
            </span>
          )}
        </div>
        {rate != null && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rateBg(rate)}`}
                style={{ width: `${Math.round(rate * 100)}%` }}
              />
            </div>
            <span className={`text-[11px] font-bold tabular-nums ${rateColor(rate)}`}>
              {fmtPct(rate)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotCard({ s, isLatest }: { s: TrichterSnapshot; isLatest: boolean }) {
  const stornoRate = s.eingegangen > 0 ? s.storniert / s.eingegangen : 0;
  const umsatzVerlust = s.umsatzEingegangen - s.umsatzGeliefert;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${isLatest ? 'border-teal-200 bg-teal-50/30' : 'border-stone-100 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-stone-900">{fmtDate(s.datum)}</div>
          {isLatest && (
            <span className="text-[10px] font-semibold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full">
              Neuester
            </span>
          )}
        </div>
        <div className="text-right">
          <div className={`text-lg font-black tabular-nums ${rateColor(s.rateGesamt)}`}>
            {fmtPct(s.rateGesamt)}
          </div>
          <div className="text-[10px] text-stone-400">Gesamt-Rate</div>
        </div>
      </div>

      {/* Trichter-Stufen */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TrichterStufe label="Eingegangen"  count={s.eingegangen} total={s.eingegangen} rate={null}           highlight={false} />
        <TrichterStufe label="In Küche"     count={s.inKueche}    total={s.eingegangen} rate={s.rateKueche}   highlight={false} />
        <TrichterStufe label="Unterwegs"    count={s.unterwegs}   total={s.inKueche}    rate={s.rateTransit}  highlight={false} />
        <TrichterStufe label="Geliefert"    count={s.geliefert}   total={s.unterwegs}   rate={s.rateAbschluss} highlight={true} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
        {[
          {
            label: 'Umsatz erzielt',
            value: fmtEur(s.umsatzGeliefert),
            sub:   `von ${fmtEur(s.umsatzEingegangen)}`,
            color: 'text-emerald-700',
            bg:    'bg-emerald-50',
          },
          {
            label: 'Umsatz-Verlust',
            value: fmtEur(umsatzVerlust),
            sub:   stornoRate > 0 ? `${Math.round(stornoRate * 100)}% storniert` : `${s.storniert} storniert`,
            color: 'text-rose-700',
            bg:    'bg-rose-50',
          },
          {
            label: 'Ø Lieferzeit',
            value: s.avgLieferMin != null ? `${Math.round(s.avgLieferMin)} min` : '—',
            sub:   'Dispatch → Geliefert',
            color: 'text-blue-700',
            bg:    'bg-blue-50',
          },
          {
            label: 'Ø Gesamtzeit',
            value: s.avgGesamtMin != null ? `${Math.round(s.avgGesamtMin)} min` : '—',
            sub:   'Bestellt → Geliefert',
            color: 'text-violet-700',
            bg:    'bg-violet-50',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-3`}>
            <div className={`text-sm font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
            <div className="text-[9px] text-stone-400 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendIcon({ snapshots }: { snapshots: TrichterSnapshot[] }) {
  if (snapshots.length < 2) return null;
  const latest = snapshots[0].rateGesamt ?? 0;
  const prev   = snapshots[1].rateGesamt ?? 0;
  const delta  = latest - prev;
  if (Math.abs(delta) < 0.02) return <Minus className="h-3 w-3 text-stone-400" />;
  if (delta > 0) return <TrendingUp className="h-3 w-3 text-emerald-600" />;
  return <TrendingDown className="h-3 w-3 text-rose-500" />;
}

interface Props {
  locationId: string | null;
}

export function EinnahmenTrichterPanel({ locationId }: Props) {
  const [open, setOpen]         = useState(false);
  const [snapshots, setSnaps]   = useState<TrichterSnapshot[]>([]);
  const [loading, setLoading]   = useState(false);
  const [computing, setComp]    = useState(false);
  const [showAll, setShowAll]   = useState(false);
  const locationIdRef           = useRef(locationId);
  locationIdRef.current         = locationId;

  const load = useCallback(() => {
    const lid = locationIdRef.current;
    if (!lid) return;
    setLoading(true);
    fetch(`/api/delivery/admin/einnahmen-trichter?action=history&days=7&location_id=${encodeURIComponent(lid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.snapshots)) setSnaps(d.snapshots as TrichterSnapshot[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const computeYesterday = () => {
    if (!locationId || computing) return;
    setComp(true);
    fetch('/api/delivery/admin/einnahmen-trichter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compute', location_id: locationId }),
    })
      .then(() => load())
      .catch(() => {})
      .finally(() => setComp(false));
  };

  const visible = showAll ? snapshots : snapshots.slice(0, 3);
  const latest  = snapshots[0] ?? null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 shrink-0">
          <Filter className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-900">Einnahmen-Trichter</div>
          <div className="text-xs text-stone-400 flex items-center gap-1">
            {latest
              ? <>
                  Gesamt-Rate {fmtPct(latest.rateGesamt)} · {fmtDate(latest.datum)}
                  <TrendIcon snapshots={snapshots} />
                </>
              : 'Konversionsanalyse: Eingegangen → Geliefert'}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-40 bg-stone-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              Noch keine Trichter-Daten. Klicke „Gestern berechnen" um zu starten.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visible.map((s, i) => (
                  <SnapshotCard key={s.id} s={s} isLatest={i === 0} />
                ))}
              </div>
              {snapshots.length > 3 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full text-center text-[11px] text-stone-400 hover:text-stone-600 py-1"
                >
                  {showAll ? 'Weniger anzeigen' : `+${snapshots.length - 3} weitere Tage anzeigen`}
                </button>
              )}
            </>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              onClick={computeYesterday}
              disabled={computing || !locationId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
              {computing ? 'Berechne…' : 'Gestern berechnen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
