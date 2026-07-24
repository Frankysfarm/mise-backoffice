'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 3612 — Smart-Timing Countdown Supremo
 * Sekundengenauer Countdown aller aktiven Bestellungen; 4-stufige Farbkodierung (grün/gelb/orange/rot);
 * Kochstart-Score 0–100; On-Time-Rate; Überfällig-Alert; Fahrer-Sync-Hinweis; 15-Sek-Polling + 1-Sek-Tick
 */

interface TimingEntry {
  order_id: string;
  bestellnummer?: string | null;
  cook_start_at: string;
  ready_target: string;
  prep_min: number;
  status: 'scheduled' | 'cooking';
  driver_eta_min?: number | null;
}

interface ApiResponse {
  timings: TimingEntry[];
  on_time_rate: number;
  kochstart_score: number;
  location_id: string;
}

const MOCK: ApiResponse = {
  timings: [
    { order_id: 'o1', bestellnummer: '#001', cook_start_at: new Date(Date.now() - 8 * 60_000).toISOString(), ready_target: new Date(Date.now() + 4 * 60_000).toISOString(), prep_min: 12, status: 'cooking', driver_eta_min: 6 },
    { order_id: 'o2', bestellnummer: '#002', cook_start_at: new Date(Date.now() - 2 * 60_000).toISOString(), ready_target: new Date(Date.now() + 10 * 60_000).toISOString(), prep_min: 12, status: 'cooking', driver_eta_min: 12 },
    { order_id: 'o3', bestellnummer: '#003', cook_start_at: new Date(Date.now() + 3 * 60_000).toISOString(), ready_target: new Date(Date.now() + 15 * 60_000).toISOString(), prep_min: 12, status: 'scheduled', driver_eta_min: 18 },
    { order_id: 'o4', bestellnummer: '#004', cook_start_at: new Date(Date.now() - 14 * 60_000).toISOString(), ready_target: new Date(Date.now() - 2 * 60_000).toISOString(), prep_min: 12, status: 'cooking', driver_eta_min: 3 },
  ],
  on_time_rate: 72,
  kochstart_score: 81,
  location_id: 'mock',
};

type Stufe = 'gruen' | 'gelb' | 'orange' | 'rot';

function getStufe(remainSec: number): Stufe {
  if (remainSec > 8 * 60) return 'gruen';
  if (remainSec > 3 * 60) return 'gelb';
  if (remainSec > 0) return 'orange';
  return 'rot';
}

const STUFE_STYLE: Record<Stufe, { bg: string; border: string; text: string; dot: string; label: string }> = {
  gruen:  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'OK' },
  gelb:   { bg: 'bg-yellow-50',  border: 'border-yellow-200',  text: 'text-yellow-700',  dot: 'bg-yellow-400',  label: 'Bald' },
  orange: { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  dot: 'bg-orange-500',  label: 'Kritisch' },
  rot:    { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Überfällig' },
};

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const r = 22, circ = 2 * Math.PI * r;
  const dash = circ - (score / 100) * circ;
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/20" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dash} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-black tabular-nums leading-none" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

export function KitchenPhase3612SmartTimingCountdownSupremo({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing-countdown?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15_000);
    const ticker = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [load]);

  const now = Date.now();
  const enriched = data.timings.map(t => {
    const readyMs = new Date(t.ready_target).getTime();
    const remainSec = Math.round((readyMs - now) / 1000);
    const stufe = getStufe(remainSec);
    const cookStartMs = new Date(t.cook_start_at).getTime();
    const cookRemainSec = Math.round((cookStartMs - now) / 1000);
    return { ...t, remainSec, stufe, cookRemainSec };
  }).sort((a, b) => a.remainSec - b.remainSec);

  const overdueCount = enriched.filter(e => e.remainSec < 0).length;
  const activeCount = enriched.filter(e => e.status === 'cooking').length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm mb-2">
      <button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-char">Smart-Timing Countdown Supremo</span>
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{overdueCount} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="font-semibold text-stone-700">{activeCount} aktiv</span>
            <span>·</span>
            <span className="text-emerald-600 font-semibold">{data.on_time_rate}% pünktlich</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Score + KPIs */}
          <div className="flex items-center gap-4 border-t border-stone-100 pt-3">
            <ScoreRing score={data.kochstart_score} />
            <div className="flex-1 grid grid-cols-3 gap-2">
              {[
                { label: 'Kochstart-Score', value: `${data.kochstart_score}`, color: data.kochstart_score >= 80 ? 'text-emerald-600' : data.kochstart_score >= 60 ? 'text-yellow-600' : 'text-red-600' },
                { label: 'On-Time-Rate', value: `${data.on_time_rate}%`, color: data.on_time_rate >= 80 ? 'text-emerald-600' : 'text-yellow-600' },
                { label: 'Aktiv / Gesamt', value: `${activeCount} / ${enriched.length}`, color: 'text-stone-700' },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-lg bg-stone-50 p-2">
                  <div className={cn('text-base font-black tabular-nums', kpi.color)}>{kpi.value}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Countdown-Kacheln */}
          {enriched.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-stone-400 py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Keine aktiven Bestellungen
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {enriched.map(e => {
                const s = STUFE_STYLE[e.stufe];
                const needsCookNow = e.status === 'scheduled' && e.cookRemainSec <= 120 && e.cookRemainSec > 0;
                return (
                  <div key={e.order_id} className={cn('rounded-lg border p-3 flex items-center gap-3', s.bg, s.border)}>
                    <div className={cn('w-2 h-2 rounded-full shrink-0', s.dot, e.stufe === 'rot' && 'animate-pulse')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-char">{e.bestellnummer ?? e.order_id.slice(0, 6)}</span>
                        <span className={cn('text-[10px] font-semibold px-1 rounded', s.bg, s.text)}>{s.label}</span>
                        {e.status === 'scheduled' && <span className="text-[10px] text-stone-400 bg-stone-100 px-1 rounded">Geplant</span>}
                        {needsCookNow && <span className="text-[10px] text-orange-700 bg-orange-100 px-1 rounded flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />Jetzt starten!</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className={cn('w-3 h-3 shrink-0', s.text)} />
                        <span className={cn('text-sm font-black tabular-nums', s.text)}>{fmtSec(e.remainSec)}</span>
                        {e.driver_eta_min != null && (
                          <span className="text-[10px] text-stone-400">· Fahrer {e.driver_eta_min}min</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
