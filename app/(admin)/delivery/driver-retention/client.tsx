'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users2, RefreshCw, AlertTriangle, CheckCircle2, TrendingDown,
  Zap, Clock, Star, Gift, MessageSquare, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  RetentionDashboard,
  RetentionDriverRow,
  RetentionTier,
  RetentionActionType,
} from '@/lib/delivery/driver-retention';

// ─── tier helpers ─────────────────────────────────────────────────────────────

const TIER_LABEL: Record<RetentionTier, string> = {
  stable:   'Stabil',
  monitor:  'Beobachten',
  at_risk:  'Gefährdet',
  churning: 'Abwandernd',
};

const TIER_COLOR: Record<RetentionTier, string> = {
  stable:   'bg-emerald-100 text-emerald-700',
  monitor:  'bg-amber-100 text-amber-700',
  at_risk:  'bg-orange-100 text-orange-700',
  churning: 'bg-red-100 text-red-700',
};

const TIER_DOT: Record<RetentionTier, string> = {
  stable:   'bg-emerald-500',
  monitor:  'bg-amber-400',
  at_risk:  'bg-orange-500',
  churning: 'bg-red-600 animate-pulse',
};

function ScoreBadge({ score, tier }: { score: number; tier: RetentionTier }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', TIER_COLOR[tier])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', TIER_DOT[tier])} />
      {score.toFixed(0)}
    </span>
  );
}

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start shadow-sm">
      <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color =
    score >= 75 ? 'bg-emerald-500' :
    score >= 55 ? 'bg-amber-400' :
    score >= 35 ? 'bg-orange-500' : 'bg-red-600';
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 text-xs text-slate-500 shrink-0">{label} <span className="text-slate-300">({weight})</span></div>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <div className="w-8 text-xs font-medium text-slate-600 text-right">{score.toFixed(0)}</div>
    </div>
  );
}

function DriverRow({
  driver,
  onAction,
}: {
  driver: RetentionDriverRow;
  onAction: (scoreId: string, driverId: string, actionType: RetentionActionType, bonusEur?: number) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const handleAction = async (type: RetentionActionType, bonus?: number) => {
    setActing(true);
    await onAction(driver.id, driver.driverId, type, bonus);
    setActing(false);
  };

  const name = driver.driverName ?? 'Fahrer';
  const hasAction = !!driver.actionTaken && driver.actionTaken !== 'none';

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={cn('h-2 w-2 rounded-full shrink-0', TIER_DOT[driver.retentionTier])} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-slate-800 truncate">{name}</div>
          <div className="text-xs text-slate-400">{driver.vehicleType ?? '—'} · {driver.driverPhone ?? '—'}</div>
        </div>
        <ScoreBadge score={driver.retentionScore} tier={driver.retentionTier} />
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          TIER_COLOR[driver.retentionTier],
        )}>
          {TIER_LABEL[driver.retentionTier]}
        </span>
        {hasAction && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            Aktion erfolgt
          </span>
        )}
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50">
          {/* component scores */}
          <div className="space-y-1.5">
            <ScoreBar label="Schicht-Frequenz" score={driver.shiftFreqScore}   weight="25%" />
            <ScoreBar label="Trinkgeld-Trend"  score={driver.tipTrendScore}    weight="20%" />
            <ScoreBar label="Incentive-Earn."  score={driver.incentiveScore}   weight="20%" />
            <ScoreBar label="Pünktlichkeit"    score={driver.ontimeTrendScore} weight="20%" />
            <ScoreBar label="No-Shows / Flags" score={driver.noshowScore}      weight="15%" />
          </div>

          {/* raw signals */}
          <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
            <div>Schichten 30d: <b className="text-slate-700">{driver.shiftsLast30d}</b> (vorher {driver.shiftsPrev30d})</div>
            <div>Trinkgeld 14d: <b className="text-slate-700">€{driver.tipEurLast14d.toFixed(2)}</b> (vorher €{driver.tipEurPrev14d.toFixed(2)})</div>
            <div>Incentive 30d: <b className="text-slate-700">€{driver.incentiveEur30d.toFixed(2)}</b></div>
            <div>Pünktl. 14d: <b className="text-slate-700">{(driver.ontimeRateLast14d * 100).toFixed(0)}%</b> (vorher {(driver.ontimeRatePrev14d * 100).toFixed(0)}%)</div>
            <div>No-Shows 14d: <b className="text-slate-700">{driver.noshowCount14d}</b></div>
            <div>Offene Flags: <b className="text-slate-700">{driver.reviewFlagsOpen}</b></div>
          </div>

          {/* actions */}
          {!hasAction && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={acting}
                onClick={() => handleAction('bonus_sent', 10)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Gift size={12} /> €10 Bonus senden
              </button>
              <button
                disabled={acting}
                onClick={() => handleAction('message_sent')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <MessageSquare size={12} /> Anschreiben markieren
              </button>
              <button
                disabled={acting}
                onClick={() => handleAction('manual_check')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                <Eye size={12} /> Manuell prüfen
              </button>
            </div>
          )}
          {hasAction && (
            <div className="text-xs text-blue-600 flex items-center gap-1">
              <CheckCircle2 size={12} />
              Aktion: {driver.actionTaken} — {driver.actionTakenAt ? new Date(driver.actionTakenAt).toLocaleString('de-DE') : '—'}
              {driver.creditEur ? ` · €${driver.creditEur.toFixed(2)} Bonus` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function DriverRetentionClient() {
  const [data, setData] = useState<RetentionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [tab, setTab] = useState<'at_risk' | 'actions' | 'trend'>('at_risk');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-retention?action=dashboard');
      if (res.ok) setData(await res.json() as RetentionDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    await fetch('/api/delivery/admin/driver-retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot' }),
    });
    setSnapshotting(false);
    await load();
  };

  const handleAction = async (
    scoreId: string,
    driverId: string,
    actionType: RetentionActionType,
    bonusEur?: number,
  ) => {
    await fetch('/api/delivery/admin/driver-retention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'take_action', scoreId, driverId, actionType, bonusEur }),
    });
    await load();
  };

  const ov = data?.overview;

  if (loading && !data) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="animate-spin mx-auto mb-2 text-slate-400" size={20} />
        <p className="text-slate-400 text-sm">Lade Retention-Daten…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users2 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Fahrer-Retention Score</h1>
            <p className="text-sm text-slate-500">5-Faktoren-Risiko-Analyse · täglich · Proaktive Maßnahmen</p>
          </div>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(snapshotting && 'animate-spin')} />
          {snapshotting ? 'Berechne…' : 'Neu berechnen'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Fahrer gesamt"
          value={ov?.driversScored ?? 0}
          sub={`Ø Score: ${ov?.avgScore?.toFixed(0) ?? '—'}`}
          icon={<Users2 size={18} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
        <KpiCard
          label="Gefährdet"
          value={(ov?.countAtRisk ?? 0) + (ov?.countChurning ?? 0)}
          sub={`davon ${ov?.countChurning ?? 0} abwandernd`}
          icon={<AlertTriangle size={18} className="text-orange-600" />}
          color="bg-orange-50"
        />
        <KpiCard
          label="Stabil / OK"
          value={(ov?.countStable ?? 0) + (ov?.countMonitor ?? 0)}
          sub={`${ov?.countStable ?? 0} stabil · ${ov?.countMonitor ?? 0} beobachten`}
          icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <KpiCard
          label="Aktionen heute"
          value={ov?.actionsTaken ?? 0}
          sub="Bonus / Nachricht / Prüfung"
          icon={<Zap size={18} className="text-amber-600" />}
          color="bg-amber-50"
        />
      </div>

      {/* distribution bar */}
      {ov && ov.driversScored > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-700 mb-3">Tier-Verteilung</div>
          <div className="flex rounded-full overflow-hidden h-4 w-full">
            {(['stable', 'monitor', 'at_risk', 'churning'] as RetentionTier[]).map(tier => {
              const count = tier === 'stable' ? ov.countStable :
                            tier === 'monitor' ? ov.countMonitor :
                            tier === 'at_risk' ? ov.countAtRisk : ov.countChurning;
              const pct = (count / ov.driversScored) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={tier}
                  style={{ width: `${pct}%` }}
                  title={`${TIER_LABEL[tier]}: ${count} (${pct.toFixed(0)}%)`}
                  className={cn(
                    tier === 'stable'   ? 'bg-emerald-500' :
                    tier === 'monitor'  ? 'bg-amber-400' :
                    tier === 'at_risk'  ? 'bg-orange-500' : 'bg-red-600',
                  )}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            {(['stable', 'monitor', 'at_risk', 'churning'] as RetentionTier[]).map(tier => {
              const count = tier === 'stable' ? ov.countStable :
                            tier === 'monitor' ? ov.countMonitor :
                            tier === 'at_risk' ? ov.countAtRisk : ov.countChurning;
              return (
                <div key={tier} className="flex items-center gap-1">
                  <span className={cn('h-2 w-2 rounded-full inline-block', TIER_DOT[tier])} />
                  {TIER_LABEL[tier]}: {count}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {([
          { key: 'at_risk',  label: 'Gefährdete Fahrer', count: (data?.atRiskDrivers ?? []).length },
          { key: 'actions',  label: 'Letzte Aktionen',    count: (data?.recentActions ?? []).length },
          { key: 'trend',    label: '7-Tage-Trend',       count: null },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* tab: at risk */}
      {tab === 'at_risk' && (
        <div className="space-y-2">
          {(data?.atRiskDrivers ?? []).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
              <p className="font-medium text-emerald-600">Keine gefährdeten Fahrer</p>
              <p className="text-sm mt-1">Alle Fahrer haben einen stabilen oder überwachten Score.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 pb-1">
                {(data?.atRiskDrivers ?? []).length} Fahrer mit Retention-Risiko — aufsteigend nach Score sortiert
              </p>
              {(data?.atRiskDrivers ?? []).map(d => (
                <DriverRow key={d.id} driver={d} onAction={handleAction} />
              ))}
            </>
          )}
        </div>
      )}

      {/* tab: actions */}
      {tab === 'actions' && (
        <div className="space-y-2">
          {(data?.recentActions ?? []).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Clock size={32} className="mx-auto mb-2" />
              <p>Noch keine Aktionen dokumentiert.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">Fahrer-ID</th>
                    <th className="text-left px-4 py-2">Aktion</th>
                    <th className="text-left px-4 py-2">Zeitpunkt</th>
                    <th className="text-right px-4 py-2">Bonus</th>
                    <th className="text-right px-4 py-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.recentActions ?? []).map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.driverId.slice(0, 8)}…</td>
                      <td className="px-4 py-2">
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {a.actionTaken}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {a.actionTakenAt ? new Date(a.actionTakenAt).toLocaleString('de-DE') : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">
                        {a.creditEur ? `€${a.creditEur.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <ScoreBadge score={a.retentionScore} tier={a.retentionTier} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* tab: trend */}
      {tab === 'trend' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          {(data?.trend7d ?? []).length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <TrendingDown size={28} className="mx-auto mb-2" />
              <p>Noch keine Verlaufsdaten vorhanden.</p>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                <Star size={14} className="text-amber-500" />
                Ø Retention Score + Risiko-Fahrer — 7 Tage
              </div>
              <div className="space-y-2">
                {(data?.trend7d ?? []).map(d => (
                  <div key={d.scoreDate} className="flex items-center gap-3">
                    <div className="w-20 text-xs text-slate-500 shrink-0">
                      {new Date(d.scoreDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden relative">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${d.avgScore}%` }}
                      />
                    </div>
                    <div className="w-10 text-xs font-medium text-slate-700 text-right">{d.avgScore.toFixed(0)}</div>
                    <div className="w-20 text-right text-xs">
                      {d.churning > 0 && (
                        <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full mr-1">
                          {d.churning} abw.
                        </span>
                      )}
                      {d.atRisk > 0 && (
                        <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                          {d.atRisk} gef.
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
