'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserX, UserCheck, Users, RefreshCw, TrendingDown,
  Gift, AlertTriangle, CheckCircle2, Clock, Zap,
  ChevronDown, ChevronUp, Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type ChurnRiskTier = 'safe' | 'warning' | 'at_risk' | 'churned';

interface ChurnRiskScore {
  id: string;
  customerEmail: string;
  customerName: string | null;
  riskScore: number;
  riskTier: ChurnRiskTier;
  daysSinceLastOrder: number | null;
  orderCount30d: number;
  orderCountPrev30d: number;
  avgOrderValueEur: number | null;
  lastOrderAt: string | null;
  campaignSentAt: string | null;
  campaignResult: 'pending' | 'converted' | 'no_response' | null;
  creditEur: number | null;
}

interface ChurnStats {
  totalCustomers: number;
  countSafe: number;
  countWarning: number;
  countAtRisk: number;
  countChurned: number;
  campaignsSent: number;
  winBacks: number;
  winBackRatePct: number | null;
  avgRiskScore: number | null;
}

interface Dashboard {
  stats: ChurnStats;
  atRiskCustomers: ChurnRiskScore[];
  recentlySentCampaigns: ChurnRiskScore[];
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function fmt(eur: number | null | undefined): string {
  if (eur == null) return '—';
  return `${eur.toFixed(2).replace('.', ',')} €`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const TIER_CONFIG: Record<ChurnRiskTier, { label: string; color: string; bg: string; border: string }> = {
  safe:    { label: 'Sicher',     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  warning: { label: 'Achtung',    color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200'   },
  at_risk: { label: 'Gefährdet',  color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200'  },
  churned: { label: 'Abgewandert',color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200'     },
};

function TierBadge({ tier }: { tier: ChurnRiskTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
      {cfg.label}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-red-500'
    : score >= 60 ? 'bg-orange-500'
    : score >= 30 ? 'bg-amber-500'
    : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-6 text-right">{score}</span>
    </div>
  );
}

// ── KPI-Karte ─────────────────────────────────────────────────────────────────

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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className="p-2 bg-gray-50 rounded-lg">
        <Icon className="h-5 w-5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={cn('text-2xl font-bold mt-0.5', color)}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Kunden-Zeile ──────────────────────────────────────────────────────────────

function CustomerRow({ customer }: { customer: ChurnRiskScore }) {
  const [open, setOpen] = useState(false);
  const cfg = TIER_CONFIG[customer.riskTier];

  return (
    <div className={cn('border rounded-lg overflow-hidden', cfg.border)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold', cfg.bg, cfg.color)}>
          {(customer.customerName ?? customer.customerEmail).substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {customer.customerName ?? customer.customerEmail}
          </p>
          <p className="text-xs text-gray-400 truncate">{customer.customerEmail}</p>
        </div>
        <div className="hidden sm:block w-36">
          <RiskBar score={customer.riskScore} />
        </div>
        <TierBadge tier={customer.riskTier} />
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className={cn('px-4 pb-4 pt-1 border-t grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm', cfg.bg)}>
          <div>
            <p className="text-xs text-gray-500">Letzter Kauf</p>
            <p className="font-medium">{fmtDate(customer.lastOrderAt)}</p>
            {customer.daysSinceLastOrder != null && (
              <p className="text-xs text-gray-400">vor {customer.daysSinceLastOrder} Tagen</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500">Bestellungen 30T / Vormonat</p>
            <p className="font-medium">{customer.orderCount30d} / {customer.orderCountPrev30d}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Ø Bestellwert</p>
            <p className="font-medium">{fmt(customer.avgOrderValueEur)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Kampagne</p>
            {customer.campaignSentAt ? (
              <div>
                <p className="font-medium">{fmtDate(customer.campaignSentAt)}</p>
                {customer.creditEur && <p className="text-xs text-gray-400">{fmt(customer.creditEur)} Gutschrift</p>}
                {customer.campaignResult === 'converted' && (
                  <span className="text-xs text-emerald-600 font-semibold">✓ Win-Back!</span>
                )}
                {customer.campaignResult === 'pending' && (
                  <span className="text-xs text-amber-600">Ausstehend</span>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Noch keine</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Risk-Donut ────────────────────────────────────────────────────────────────

function RiskDonut({ stats }: { stats: ChurnStats }) {
  const total = stats.totalCustomers || 1;
  const slices = [
    { tier: 'safe'    as ChurnRiskTier, count: stats.countSafe    },
    { tier: 'warning' as ChurnRiskTier, count: stats.countWarning },
    { tier: 'at_risk' as ChurnRiskTier, count: stats.countAtRisk  },
    { tier: 'churned' as ChurnRiskTier, count: stats.countChurned },
  ];

  const colors: Record<ChurnRiskTier, string> = {
    safe:    '#10b981',
    warning: '#f59e0b',
    at_risk: '#f97316',
    churned: '#ef4444',
  };

  // Simple SVG donut
  const r = 40;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="120" height="120" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="18" />
        {slices.map(({ tier, count }) => {
          const pct = count / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const el = (
            <circle
              key={tier}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={colors[tier]}
              strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
            />
          );
          offset += dash;
          return el;
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-xs" fill="#6b7280" fontSize="10">Kunden</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#111827" fontSize="16" fontWeight="bold">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {slices.map(({ tier, count }) => {
          const cfg = TIER_CONFIG[tier];
          return (
            <div key={tier} className="flex items-center gap-2 text-sm">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: colors[tier] }} />
              <span className="text-gray-600 w-24">{cfg.label}</span>
              <span className="font-semibold text-gray-900">{count}</span>
              <span className="text-gray-400 text-xs">({Math.round(count / total * 100)} %)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Kampagnen-Konfiguration ────────────────────────────────────────────────────

function CampaignForm({
  onRun,
  loading,
}: {
  onRun: (opts: { dryRun: boolean; maxCustomers: number; creditAtRiskEur: number; creditChurnedEur: number }) => void;
  loading: boolean;
}) {
  const [dryRun, setDryRun]               = useState(true);
  const [maxCustomers, setMaxCustomers]   = useState(50);
  const [creditAtRisk, setCreditAtRisk]   = useState(3.0);
  const [creditChurned, setCreditChurned] = useState(5.0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Gift className="h-4 w-4 text-violet-600" />
        Re-Engagement Kampagne
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Max. Kunden</span>
          <input
            type="number" min={1} max={200}
            value={maxCustomers}
            onChange={e => setMaxCustomers(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Gutschrift Gefährdet (€)</span>
          <input
            type="number" min={0} step={0.5}
            value={creditAtRisk}
            onChange={e => setCreditAtRisk(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-gray-500">Gutschrift Abgewandert (€)</span>
          <input
            type="number" min={0} step={0.5}
            value={creditChurned}
            onChange={e => setCreditChurned(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600">Probelauf (kein Versand)</span>
        </label>
        <button
          onClick={() => onRun({ dryRun, maxCustomers, creditAtRiskEur: creditAtRisk, creditChurnedEur: creditChurned })}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {dryRun ? 'Probelauf starten' : 'Kampagne starten'}
        </button>
      </div>
    </div>
  );
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────

export function ChurnPreventionClient({ locationId }: { locationId: string }) {
  const [data, setData]           = useState<Dashboard | null>(null);
  const [loading, setLoading]     = useState(true);
  const [actionLoading, setAction] = useState(false);
  const [toast, setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'at_risk' | 'campaigns'>('at_risk');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/churn-prevention`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as Dashboard);
    } catch (e) {
      setToast({ type: 'err', msg: e instanceof Error ? e.message : 'Ladefehler' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function runAnalyze() {
    setAction(true);
    try {
      const res = await fetch('/api/delivery/admin/churn-prevention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' }),
      });
      const json = await res.json() as { analyzed?: number; upserted?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Fehler');
      setToast({ type: 'ok', msg: `${json.analyzed ?? 0} Kunden analysiert, ${json.upserted ?? 0} aktualisiert` });
      await load();
    } catch (e) {
      setToast({ type: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    } finally {
      setAction(false);
    }
  }

  async function runCampaign(opts: {
    dryRun: boolean; maxCustomers: number; creditAtRiskEur: number; creditChurnedEur: number;
  }) {
    setAction(true);
    try {
      const res = await fetch('/api/delivery/admin/churn-prevention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'campaign', ...opts }),
      });
      const json = await res.json() as {
        eligible?: number; campaignsSent?: number; creditsIssued?: number; dryRun?: boolean; error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'Fehler');
      const pfx = json.dryRun ? '[Probelauf] ' : '';
      setToast({
        type: 'ok',
        msg: `${pfx}${json.eligible ?? 0} geeignet, ${json.campaignsSent ?? 0} Kampagnen, ${json.creditsIssued ?? 0} Gutschriften`,
      });
      if (!opts.dryRun) await load();
    } catch (e) {
      setToast({ type: 'err', msg: e instanceof Error ? e.message : 'Fehler' });
    } finally {
      setAction(false);
    }
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Toast */}
      {toast && (
        <div
          onClick={() => setToast(null)}
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer',
            toast.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200',
          )}
        >
          {toast.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header-Aktionen */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Erkennt abwandernde Kunden via RFM-Scoring · Sendet automatisch Gutschriften
        </p>
        <div className="flex gap-2">
          <button
            onClick={runAnalyze}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Analyse starten
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={Users}
          label="Kunden analysiert"
          value={stats?.totalCustomers ?? '—'}
          sub={stats?.avgRiskScore != null ? `Ø Risiko ${stats.avgRiskScore}` : undefined}
        />
        <KpiCard
          icon={UserX}
          label="Gefährdet / Abgewandert"
          value={stats ? (stats.countAtRisk + stats.countChurned) : '—'}
          color="text-red-600"
          sub={stats ? `${stats.countAtRisk} gefährdet, ${stats.countChurned} abgewandert` : undefined}
        />
        <KpiCard
          icon={Mail}
          label="Kampagnen versendet"
          value={stats?.campaignsSent ?? '—'}
          sub="letzten 30 Tage"
        />
        <KpiCard
          icon={UserCheck}
          label="Win-Backs"
          value={stats?.winBacks ?? '—'}
          color="text-emerald-600"
          sub={stats?.winBackRatePct != null ? `${stats.winBackRatePct} % Erfolgsquote` : undefined}
        />
      </div>

      {/* Risikoverteilung + Kampagnen-Form */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Risikoverteilung
          </h3>
          {stats ? <RiskDonut stats={stats} /> : (
            <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
          )}
        </div>
        <CampaignForm onRun={runCampaign} loading={actionLoading} />
      </div>

      {/* Kundenliste */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {([
            { id: 'at_risk', label: `Gefährdet/Abgewandert (${data?.atRiskCustomers.length ?? 0})` },
            { id: 'campaigns', label: `Versendete Kampagnen (${data?.recentlySentCampaigns.length ?? 0})` },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
            ))
          ) : activeTab === 'at_risk' ? (
            data?.atRiskCustomers.length ? (
              data.atRiskCustomers.map(c => <CustomerRow key={c.id} customer={c} />)
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Keine gefährdeten Kunden — Analyse starten</p>
              </div>
            )
          ) : (
            data?.recentlySentCampaigns.length ? (
              data.recentlySentCampaigns.map(c => <CustomerRow key={c.id} customer={c} />)
            ) : (
              <div className="py-12 text-center">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Noch keine Kampagnen versendet</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Info-Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">So funktioniert die Churn-Prävention</p>
        <ul className="space-y-0.5 text-blue-700 list-disc list-inside">
          <li>RFM-Score aus Recency (Tage seit letzter Bestellung), Frequency-Rückgang und Aktivität</li>
          <li>Tier Gefährdet (≥ 60) erhält {fmt(3)} Gutschrift · Tier Abgewandert (≥ 80) erhält {fmt(5)} Gutschrift</li>
          <li>Kampagne wird maximal alle 14 Tage wiederholt</li>
          <li>Win-Back wird automatisch erkannt wenn der Kunde nach Kampagnenversand wieder bestellt</li>
          <li>Cron-Analyse läuft täglich um 02:00 UTC · Re-Engagement täglich um 04:00 UTC</li>
        </ul>
      </div>
    </div>
  );
}
