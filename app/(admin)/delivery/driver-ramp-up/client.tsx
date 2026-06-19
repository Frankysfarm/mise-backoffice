'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Users, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  GraduationCap, Flag, XCircle, ChevronDown, ChevronUp, Star,
  Activity, Zap, Award, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type RampUpTier = 'struggling' | 'developing' | 'promising' | 'graduated';
type PredictedRetention = 'high' | 'medium' | 'low';

interface RampUpProfile {
  id: string;
  driverId: string;
  driverName: string | null;
  vehicleType: string | null;
  firstDeliveryAt: string | null;
  rampUpDay: number;
  deliveriesInPeriod: number;
  onTimeRatePct: number | null;
  avgDeliveryMin: number | null;
  avgRating: number | null;
  cancellationRatePct: number | null;
  rampUpScore: number;
  rampUpTier: RampUpTier;
  coachingFlag: boolean;
  coachingReason: string | null;
  coachingFlaggedAt: string | null;
  predictedRetention: PredictedRetention | null;
  graduatedAt: string | null;
  computedAt: string;
}

interface RampUpKpis {
  activeNewHires: number;
  graduatingSoon: number;
  atRiskCount: number;
  avgCohortScore: number;
  graduatedLast7d: number;
  coachingFlagged: number;
}

interface RampUpDashboard {
  kpis: RampUpKpis;
  profiles: RampUpProfile[];
  recentGraduates: RampUpProfile[];
}

// ── Tier-Konfiguration ────────────────────────────────────────────────────────

const TIER_CFG: Record<RampUpTier, { label: string; color: string; bg: string; border: string; dot: string }> = {
  struggling: { label: 'Struggling',  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500'     },
  developing: { label: 'Developing',  color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500'   },
  promising:  { label: 'Promising',   color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  graduated:  { label: 'Abgeschlossen', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200',  dot: 'bg-indigo-500'  },
};

const RETENTION_CFG: Record<PredictedRetention, { label: string; color: string }> = {
  high:   { label: 'Hoch',   color: 'text-emerald-600' },
  medium: { label: 'Mittel', color: 'text-amber-600'   },
  low:    { label: 'Niedrig', color: 'text-red-600'    },
};

const VEHICLE_LABELS: Record<string, string> = {
  bicycle: 'Fahrrad', moped: 'Moped', car: 'Auto',
  scooter: 'Roller', ebike: 'E-Bike',
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtNum(v: number | null, decimals = 1, suffix = ''): string {
  if (v == null) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

// ── Unterkomponenten ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color = 'text-gray-700',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-gray-50">
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: RampUpTier }) {
  const cfg = TIER_CFG[tier];
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ score, tier }: { score: number; tier: RampUpTier }) {
  const color =
    tier === 'struggling' ? 'bg-red-500'
    : tier === 'developing' ? 'bg-amber-500'
    : tier === 'promising' ? 'bg-emerald-500'
    : 'bg-indigo-500';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold tabular-nums w-8 text-right text-gray-700">{score}</span>
    </div>
  );
}

function ProgressBar({ day }: { day: number }) {
  const pct = Math.min((day / 60) * 100, 100);
  const color = pct >= 90 ? 'bg-indigo-500' : pct >= 50 ? 'bg-blue-400' : 'bg-blue-300';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 whitespace-nowrap">Tag {day}/60</span>
    </div>
  );
}

// ── CoachingModal ─────────────────────────────────────────────────────────────

function CoachingModal({
  profile,
  locationId,
  onClose,
  onDone,
}: {
  profile: RampUpProfile;
  locationId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleFlag() {
    if (!reason.trim()) return;
    setLoading(true);
    await fetch('/api/delivery/admin/driver-ramp-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flag', driver_id: profile.driverId, reason, location_id: locationId }),
    });
    setLoading(false);
    onDone();
  }

  async function handleClear() {
    setLoading(true);
    await fetch('/api/delivery/admin/driver-ramp-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_flag', driver_id: profile.driverId, location_id: locationId }),
    });
    setLoading(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-1">
          Coaching-Flag — {profile.driverName ?? 'Fahrer'}
        </h3>
        {profile.coachingFlag && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm font-medium text-orange-700">Aktiv: {profile.coachingReason}</p>
            <p className="text-xs text-orange-500 mt-0.5">Seit {fmtDate(profile.coachingFlaggedAt)}</p>
          </div>
        )}
        {!profile.coachingFlag && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Gib einen Grund an, damit der Manager weiß, welches Coaching nötig ist.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-orange-300"
              placeholder="z.B. Pünktlichkeitsrate unter 50 %, Gespräch führen..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              onClick={handleFlag}
              disabled={loading || !reason.trim()}
            >
              {loading ? 'Speichern…' : 'Flag setzen'}
            </button>
          </>
        )}
        {profile.coachingFlag && (
          <button
            className="mt-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
            onClick={handleClear}
            disabled={loading}
          >
            {loading ? 'Wird gelöscht…' : 'Flag zurücksetzen'}
          </button>
        )}
        <button className="mt-2 w-full text-sm text-gray-400 hover:text-gray-600" onClick={onClose}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ── DriverCard ────────────────────────────────────────────────────────────────

function DriverCard({
  profile,
  locationId,
  onAction,
}: {
  profile: RampUpProfile;
  locationId: string;
  onAction: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [graduating, setGraduating] = useState(false);

  async function handleGraduate() {
    setGraduating(true);
    await fetch('/api/delivery/admin/driver-ramp-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'graduate', driver_id: profile.driverId, location_id: locationId }),
    });
    setGraduating(false);
    onAction();
  }

  const retention = profile.predictedRetention ? RETENTION_CFG[profile.predictedRetention] : null;
  const ini = initials(profile.driverName);
  const tierCfg = TIER_CFG[profile.rampUpTier];

  return (
    <div className={cn('bg-white border rounded-xl overflow-hidden', profile.coachingFlag ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200')}>
      {/* Header-Zeile */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0', tierCfg.dot)}>
          {ini}
        </div>

        {/* Name + Vehicle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">
              {profile.driverName ?? `Fahrer-${profile.driverId.slice(0, 6)}`}
            </span>
            <TierBadge tier={profile.rampUpTier} />
            {profile.coachingFlag && (
              <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-semibold">
                ⚑ Coaching
              </span>
            )}
          </div>
          <div className="mt-1">
            <ProgressBar day={profile.rampUpDay} />
          </div>
        </div>

        {/* Score */}
        <div className="w-28 flex-shrink-0">
          <ScoreBar score={profile.rampUpScore} tier={profile.rampUpTier} />
        </div>

        {/* Expand-Toggle */}
        <div className="text-gray-400 flex-shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expand-Panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Erste Lieferung</p>
              <p className="font-semibold text-gray-800">{fmtDate(profile.firstDeliveryAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lieferungen</p>
              <p className="font-semibold text-gray-800">{profile.deliveriesInPeriod}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Pünktlichkeit</p>
              <p className="font-semibold text-gray-800">{fmtNum(profile.onTimeRatePct, 1, '%')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Ø Lieferzeit</p>
              <p className="font-semibold text-gray-800">{fmtNum(profile.avgDeliveryMin, 0, ' Min')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Kundenbewertung</p>
              <p className="font-semibold text-gray-800 flex items-center gap-1">
                {profile.avgRating != null ? (
                  <><Star className="h-3 w-3 text-amber-500 fill-amber-400" />{profile.avgRating.toFixed(2)}</>
                ) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Stornierungsrate</p>
              <p className="font-semibold text-gray-800">{fmtNum(profile.cancellationRatePct, 1, '%')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Fahrzeug</p>
              <p className="font-semibold text-gray-800">
                {profile.vehicleType ? VEHICLE_LABELS[profile.vehicleType] ?? profile.vehicleType : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Retention-Prognose</p>
              <p className={cn('font-semibold', retention?.color ?? 'text-gray-500')}>
                {retention?.label ?? '—'}
              </p>
            </div>
          </div>

          {profile.coachingFlag && profile.coachingReason && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
              <span className="font-medium text-orange-700">Coaching-Grund: </span>
              <span className="text-orange-600">{profile.coachingReason}</span>
            </div>
          )}

          {/* Aktionen */}
          <div className="flex gap-2 flex-wrap">
            <button
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors',
                profile.coachingFlag
                  ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700',
              )}
              onClick={() => setCoaching(true)}
            >
              <Flag className="h-3.5 w-3.5" />
              {profile.coachingFlag ? 'Coaching-Flag' : 'Flag setzen'}
            </button>

            {profile.rampUpTier !== 'graduated' && (
              <button
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                onClick={handleGraduate}
                disabled={graduating}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                {graduating ? 'Wird gespeichert…' : 'Abschließen (Graduation)'}
              </button>
            )}
          </div>
        </div>
      )}

      {coaching && (
        <CoachingModal
          profile={profile}
          locationId={locationId}
          onClose={() => setCoaching(false)}
          onDone={() => { setCoaching(false); onAction(); }}
        />
      )}
    </div>
  );
}

// ── Haupt-Client-Komponente ───────────────────────────────────────────────────

const TABS = [
  { key: 'all',        label: 'Alle' },
  { key: 'struggling', label: 'Struggling' },
  { key: 'developing', label: 'Developing' },
  { key: 'promising',  label: 'Promising' },
  { key: 'graduated',  label: 'Abgeschlossen' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function DriverRampUpClient({
  locationId,
  initial,
}: {
  locationId: string;
  initial: RampUpDashboard | null;
}) {
  const [data, setData] = useState<RampUpDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>('all');
  const [countdown, setCountdown] = useState(300);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/driver-ramp-up?location_id=${locationId}`);
      if (res.ok) {
        const json = (await res.json()) as { dashboard: RampUpDashboard };
        setData(json.dashboard);
      }
    } finally {
      setLoading(false);
      setCountdown(300);
    }
  }, [locationId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void refresh(); return 300; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  const kpis = data?.kpis;
  const allProfiles = data?.profiles ?? [];
  const recentGraduates = data?.recentGraduates ?? [];

  const filtered =
    tab === 'all' ? allProfiles
    : tab === 'graduated' ? recentGraduates
    : allProfiles.filter((p) => p.rampUpTier === tab);

  const coachingFlagged = allProfiles.filter((p) => p.coachingFlag);

  return (
    <div className="space-y-6">
      {/* Coaching-Alert-Banner */}
      {coachingFlagged.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-800">
              {coachingFlagged.length} Fahrer brauchen Coaching
            </p>
            <p className="text-sm text-orange-600 mt-0.5">
              {coachingFlagged.map((p) => p.driverName ?? `Fahrer-${p.driverId.slice(0, 6)}`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={Users}
          label="Neue Fahrer aktiv"
          value={kpis?.activeNewHires ?? '—'}
          sub="Im Ramp-Up (< 60 Tage)"
          color="text-blue-600"
        />
        <KpiCard
          icon={GraduationCap}
          label="Graduation bald"
          value={kpis?.graduatingSoon ?? '—'}
          sub="Tag 50–59"
          color="text-indigo-600"
        />
        <KpiCard
          icon={AlertTriangle}
          label="At-Risk"
          value={kpis?.atRiskCount ?? '—'}
          sub="Struggling-Tier"
          color="text-red-600"
        />
        <KpiCard
          icon={Target}
          label="Ø Cohort-Score"
          value={kpis?.avgCohortScore ?? '—'}
          sub="Alle neuen Fahrer"
          color="text-emerald-600"
        />
        <KpiCard
          icon={Award}
          label="Letzte 7 Tage"
          value={kpis?.graduatedLast7d ?? '—'}
          sub="Abgeschlossen"
          color="text-violet-600"
        />
        <KpiCard
          icon={Flag}
          label="Coaching-Flags"
          value={kpis?.coachingFlagged ?? '—'}
          sub="Offen"
          color="text-orange-600"
        />
      </div>

      {/* Tabs + Refresh */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map((t) => {
            const count =
              t.key === 'all' ? allProfiles.length
              : t.key === 'graduated' ? recentGraduates.length
              : allProfiles.filter((p) => p.rampUpTier === t.key).length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  tab === t.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {t.label}
                {count > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-200 rounded-full px-1.5 py-0.5 tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="text-xs">{loading ? 'Lädt…' : `${countdown}s`}</span>
        </button>
      </div>

      {/* Fahrer-Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {tab === 'all'
              ? 'Keine neuen Fahrer im Ramp-Up-Programm'
              : `Keine Fahrer im Tier "${TABS.find((t) => t.key === tab)?.label ?? tab}"`}
          </p>
          <p className="text-xs mt-1">Performance-Snapshots werden täglich um 02:00 UTC berechnet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((profile) => (
            <DriverCard
              key={profile.id}
              profile={profile}
              locationId={locationId}
              onAction={refresh}
            />
          ))}
        </div>
      )}

      {/* Tier-Legende */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Score-Erklärung
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          {(Object.entries(TIER_CFG) as [RampUpTier, typeof TIER_CFG[RampUpTier]][]).map(([tier, cfg]) => (
            <div key={tier} className="flex items-start gap-2">
              <div className={cn('w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0', cfg.dot)} />
              <div>
                <p className={cn('font-semibold text-xs', cfg.color)}>{cfg.label}</p>
                <p className="text-xs text-gray-400">
                  {tier === 'graduated' ? '60 Tage / 200 Lieferungen'
                  : tier === 'promising' ? 'Score ≥ 70'
                  : tier === 'developing' ? 'Score 40–69'
                  : 'Score < 40'}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs text-gray-500">
          <div><span className="font-semibold">Pünktlichkeit:</span> 0–35 Pkt</div>
          <div><span className="font-semibold">Volumen:</span> 0–25 Pkt (100 Stopps = max)</div>
          <div><span className="font-semibold">Bewertung:</span> 0–25 Pkt (Rating 1–5)</div>
          <div><span className="font-semibold">Zuverlässigkeit:</span> 0–15 Pkt (Storno-Rate)</div>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 text-center">
        <Zap className="inline h-3 w-3 mr-1" />
        5-Min Auto-Refresh · Täglich neu berechnet aus Performance-Snapshots · Coaching-Flags werden auch bei Score &lt; 40 nach Tag 14 auto-gesetzt
      </div>
    </div>
  );
}
