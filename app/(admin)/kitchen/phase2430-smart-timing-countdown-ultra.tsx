'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Clock, Zap, CheckCircle2 } from 'lucide-react';

interface BatchCountdown {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  startedAt: string | null;
  estimatedPrepMin: number;
  elapsedMin: number;
  remainingMin: number;
  urgency: 'on_track' | 'due_soon' | 'overdue';
  status: string;
  driverName: string | null;
}

interface Summary {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  avgRemainingMin: number | null;
}

interface ApiData {
  batches: BatchCountdown[];
  summary: Summary;
}

function urgencyStyle(u: string) {
  if (u === 'overdue') return { bg: 'bg-red-50 border-red-300', text: 'text-red-700', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700' };
  if (u === 'due_soon') return { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' };
  return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', badge: 'bg-green-100 text-green-700' };
}

function fmtMin(m: number) {
  if (m <= 0) return '0:00';
  const mins = Math.floor(Math.abs(m));
  const secs = Math.round((Math.abs(m) - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="26" y="30" textAnchor="middle" fontSize="9" fontWeight="bold" fill={color}>
        {remaining > 0 ? `${Math.ceil(remaining)}m` : 'Fertig'}
      </text>
    </svg>
  );
}

export function KitchenPhase2430SmartTimingCountdownUltra({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-batch-countdown?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 30 * 1000);
    const ticker = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [locationId]);

  const hasAlert = (data?.summary.overdueCount ?? 0) > 0;
  const hasDueSoon = (data?.summary.dueSoonCount ?? 0) > 0;

  const headerBg = hasAlert
    ? 'border-red-300 bg-red-50'
    : hasDueSoon
    ? 'border-amber-300 bg-amber-50'
    : 'border-matcha-200 bg-matcha-50';

  const batches = data?.batches ?? [];
  const onTimeCount = batches.filter(b => b.urgency === 'on_track').length;
  const onTimeQuote = batches.length > 0 ? Math.round((onTimeCount / batches.length) * 100) : 100;

  return (
    <div className={`rounded-xl border mb-3 ${headerBg}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Clock size={16} className={hasAlert ? 'text-red-600' : 'text-matcha-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-matcha-800'}`}>
            Smart-Timing Countdown
            {data ? ` — ${batches.length} aktiv` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
              {data!.summary.overdueCount} überfällig
            </span>
          )}
          {!hasAlert && hasDueSoon && (
            <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-2 py-0.5">
              {data!.summary.dueSoonCount} bald fällig
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500 animate-pulse">Lade Countdown-Daten…</p>
          ) : (
            <>
              {/* KPI Strip */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'On-Time-Quote',
                    value: `${onTimeQuote}%`,
                    color: onTimeQuote >= 80 ? 'text-green-700' : onTimeQuote >= 60 ? 'text-amber-700' : 'text-red-700',
                    bg: onTimeQuote >= 80 ? 'bg-green-50 border-green-200' : onTimeQuote >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200',
                  },
                  {
                    label: 'Ø Restzeit',
                    value: data.summary.avgRemainingMin != null ? `${Math.ceil(data.summary.avgRemainingMin)} Min` : '—',
                    color: 'text-blue-700',
                    bg: 'bg-blue-50 border-blue-200',
                  },
                  {
                    label: 'Aktive Batches',
                    value: data.summary.activeBatches.toString(),
                    color: 'text-matcha-700',
                    bg: 'bg-matcha-50 border-matcha-200',
                  },
                ].map(k => (
                  <div key={k.label} className={`rounded-lg p-2 border text-center ${k.bg}`}>
                    <p className={`text-base font-black ${k.color}`}>{k.value}</p>
                    <p className="text-[10px] text-gray-500">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Alert Banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={13} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800 font-semibold">
                    {data.summary.overdueCount} Batch{data.summary.overdueCount !== 1 ? 'es' : ''} überfällig — Abholung sofort koordinieren!
                  </p>
                </div>
              )}

              {/* Countdown Cards */}
              {batches.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle2 size={14} className="text-green-500" />
                  Keine aktiven Batches in Zubereitung.
                </div>
              ) : (
                <div className="space-y-2">
                  {batches.map(b => {
                    const s = urgencyStyle(b.urgency);
                    const progressPct = b.estimatedPrepMin > 0
                      ? Math.min(100, (b.elapsedMin / b.estimatedPrepMin) * 100)
                      : 0;
                    const remaining = Math.max(0, b.remainingMin);
                    return (
                      <div key={b.batchId} className={`rounded-lg border p-3 ${s.bg}`}>
                        <div className="flex items-start gap-3">
                          <CountdownRing remaining={remaining} total={b.estimatedPrepMin} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-800 truncate">
                                {b.ordersCount} Bestellung{b.ordersCount !== 1 ? 'en' : ''}
                                {b.zone ? ` · Zone ${b.zone}` : ''}
                              </span>
                              <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${s.badge}`}>
                                {b.urgency === 'overdue' ? 'ÜBERFÄLLIG' : b.urgency === 'due_soon' ? 'BALD FÄLLIG' : 'ON TRACK'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">
                                {Math.round(b.elapsedMin)}/{b.estimatedPrepMin} Min
                              </span>
                            </div>
                            {b.driverName && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                <Zap size={9} className="inline mr-0.5" />
                                Fahrer: {b.driverName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex gap-3 text-[10px] text-gray-500 pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> On Track
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Bald fällig
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Überfällig
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
