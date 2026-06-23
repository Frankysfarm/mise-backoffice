'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, RefreshCw, Star, Clock } from 'lucide-react';

interface Prognose {
  id:              string;
  kundeTelefon:    string;
  kundeName:       string | null;
  p30:             number;
  p60:             number;
  p90:             number;
  letzterKauf:     string;
  bestellungen90d: number;
  avgBestellwert:  number | null;
}

interface Dashboard {
  totalKunden:   number;
  avgP30:        number | null;
  highRisk:      Prognose[];
  mediumRisk:    Prognose[];
  lowRisk:       Prognose[];
  prognoseDatum: string | null;
}

function fmtPct(v: number) {
  return Math.round(v * 100) + '%';
}

function fmtEur(v: number | null) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function pctColor(p: number) {
  if (p >= 0.7) return 'text-emerald-700';
  if (p >= 0.4) return 'text-amber-700';
  return 'text-rose-600';
}

function pctBg(p: number) {
  if (p >= 0.7) return 'bg-emerald-500';
  if (p >= 0.4) return 'bg-amber-400';
  return 'bg-rose-400';
}

function ProbBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] text-stone-400 w-7 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${pctBg(value)}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-9 text-right ${pctColor(value)}`}>
        {fmtPct(value)}
      </span>
    </div>
  );
}

function KundenRow({ p }: { p: Prognose }) {
  const name = p.kundeName ?? p.kundeTelefon;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-stone-50 last:border-0">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50 text-teal-700 shrink-0 mt-0.5">
        <TrendingUp className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-stone-800 truncate">{name}</div>
        <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
          <span>{p.bestellungen90d}× 90d</span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {fmtDate(p.letzterKauf)}
          </span>
          {p.avgBestellwert != null && (
            <>
              <span>·</span>
              <span>Ø {fmtEur(p.avgBestellwert)}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 space-y-0.5">
          <ProbBar value={p.p30} label="30d" />
          <ProbBar value={p.p60} label="60d" />
        </div>
      </div>
      <div className={`text-base font-black tabular-nums ${pctColor(p.p30)} shrink-0 mt-1`}>
        {fmtPct(p.p30)}
      </div>
    </div>
  );
}

interface Props {
  locationId: string | null;
}

export function WiederkaufPrognosenPanel({ locationId }: Props) {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [computing, setComp]  = useState(false);
  const [tab, setTab]         = useState<'high' | 'medium' | 'low'>('high');
  const locationIdRef         = useRef(locationId);
  locationIdRef.current       = locationId;

  const load = useCallback(() => {
    const lid = locationIdRef.current;
    if (!lid) return;
    setLoading(true);
    fetch(`/api/delivery/admin/wiederkauf-prediktion?location_id=${encodeURIComponent(lid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.totalKunden != null) {
          setData({
            totalKunden:   d.totalKunden,
            avgP30:        d.avgP30 ?? null,
            highRisk:      d.highRisk ?? [],
            mediumRisk:    d.mediumRisk ?? [],
            lowRisk:       d.lowRisk ?? [],
            prognoseDatum: d.prognoseDatum ?? null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open && locationId) load();
  }, [open, locationId, load]);

  const compute = () => {
    if (!locationId || computing) return;
    setComp(true);
    fetch('/api/delivery/admin/wiederkauf-prediktion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'compute', location_id: locationId }),
    })
      .then(() => load())
      .catch(() => {})
      .finally(() => setComp(false));
  };

  const kunden = tab === 'high' ? (data?.highRisk ?? [])
               : tab === 'medium' ? (data?.mediumRisk ?? [])
               : (data?.lowRisk ?? []);

  const tabLabel = (t: typeof tab) => ({
    high:   `Sehr wahrscheinlich (≥70%)`,
    medium: `Möglich (40–70%)`,
    low:    `Unwahrscheinlich (<40%)`,
  }[t]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700 shrink-0">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-900">Wiederkauf-Prognosen</div>
          <div className="text-xs text-stone-400">
            {data
              ? `${data.totalKunden} Kunden · Ø ${data.avgP30 != null ? fmtPct(data.avgP30) : '—'} Wiederkaufrate (30d)`
              : 'Wahrscheinlichkeit erneuter Bestellungen'}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 pb-5 pt-4 space-y-4">
          {/* KPI-Leiste */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Gesamt Kunden', value: data.totalKunden.toString(), color: 'text-teal-700', bg: 'bg-teal-50' },
                { label: 'Ø 30d Chance', value: data.avgP30 != null ? fmtPct(data.avgP30) : '—', color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Sehr wahrsch.', value: data.highRisk.length.toString(), color: 'text-violet-700', bg: 'bg-violet-50' },
              ].map((kpi) => (
                <div key={kpi.label} className={`rounded-xl ${kpi.bg} p-3`}>
                  <div className={`text-lg font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] font-semibold text-stone-500 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tab-Bar */}
          <div className="flex gap-2 flex-wrap">
            {(['high', 'medium', 'low'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                  tab === t
                    ? t === 'high' ? 'bg-emerald-600 text-white' : t === 'medium' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                }`}
              >
                {t === 'high' ? `Sehr wahrsch. (${data?.highRisk.length ?? 0})`
                 : t === 'medium' ? `Möglich (${data?.mediumRisk.length ?? 0})`
                 : `Niedrig (${data?.lowRisk.length ?? 0})`}
              </button>
            ))}
          </div>

          {/* Kunden-Liste */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : kunden.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm">
              {data ? 'Keine Kunden in diesem Segment.' : 'Noch keine Prognosen berechnet.'}
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
                {tabLabel(tab)} — {kunden.length} Kunden
              </div>
              <div className="divide-y divide-stone-50">
                {kunden.map((p) => <KundenRow key={p.id} p={p} />)}
              </div>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex items-center justify-between pt-1">
            {data?.prognoseDatum && (
              <span className="text-[10px] text-stone-400 flex items-center gap-1">
                <Star className="h-2.5 w-2.5" />
                Prognose vom {new Date(data.prognoseDatum).toLocaleDateString('de-DE')}
              </span>
            )}
            <button
              onClick={compute}
              disabled={computing || !locationId}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600 text-white text-[11px] font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${computing ? 'animate-spin' : ''}`} />
              {computing ? 'Berechne…' : 'Neu berechnen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
