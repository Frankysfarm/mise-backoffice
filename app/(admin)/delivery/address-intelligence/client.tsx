'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Home,
  Bell,
  BellOff,
  Package,
  Info,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AddressIntelligenceDashboard,
  AddressIssue,
  ProblematicAddress,
  AddressIntelligenceStats,
} from '@/lib/delivery/address-intelligence';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

function qualityColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function qualityBg(score: number): string {
  if (score >= 80) return 'bg-green-900/30 border-green-700/40';
  if (score >= 50) return 'bg-amber-900/30 border-amber-700/40';
  return 'bg-red-900/30 border-red-700/40';
}

const ISSUE_LABELS: Record<string, string> = {
  unreachable: 'Nicht erreichbar',
  wrong_address: 'Falsche Adresse',
  no_answer: 'Niemand geöffnet',
  access_denied: 'Kein Zugang',
  unsafe: 'Sicherheitsbedenken',
  other: 'Sonstiges',
};

const ISSUE_COLORS: Record<string, string> = {
  unreachable: 'bg-red-900/40 text-red-300',
  wrong_address: 'bg-purple-900/40 text-purple-300',
  no_answer: 'bg-amber-900/40 text-amber-300',
  access_denied: 'bg-orange-900/40 text-orange-300',
  unsafe: 'bg-red-900/60 text-red-200',
  other: 'bg-zinc-700/60 text-zinc-300',
};

// ─── KPI-Karte ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-matcha-400',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

// ─── Problem-Adress-Zeile ───────────────────────────────────────────────────

function ProblematicAddressRow({
  addr,
  onResolve,
}: {
  addr: ProblematicAddress;
  onResolve: (hash: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-lg border p-3 ${qualityBg(addr.qualityScore)}`}>
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">
              {addr.addressDisplay ?? addr.addressHash.slice(0, 16) + '…'}
            </p>
            <p className="text-xs text-zinc-400">
              {addr.issueCount} Probleme · {addr.affectedOrders} Bestellungen betroffen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold ${qualityColor(addr.qualityScore)}`}>
            {addr.qualityScore}%
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50 space-y-2">
          <div className="flex flex-wrap gap-1">
            {addr.issueTypes.map((t) => (
              <span
                key={t}
                className={`text-xs px-2 py-0.5 rounded-full ${ISSUE_COLORS[t] ?? 'bg-zinc-700 text-zinc-300'}`}
              >
                {ISSUE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Letztes Problem: {timeAgo(addr.lastIssueAt)}</span>
            <span>Erstes Problem: {timeAgo(addr.firstIssueAt)}</span>
          </div>
          <button
            onClick={() => onResolve(addr.addressHash)}
            className="w-full text-xs py-1.5 rounded-md bg-green-900/30 border border-green-700/40 text-green-400 hover:bg-green-800/40 transition-colors"
          >
            Alle Probleme als gelöst markieren
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Issue-Log-Zeile ────────────────────────────────────────────────────────

function IssueRow({ issue, onResolve }: { issue: AddressIssue; onResolve: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-700/40 last:border-0">
      <span
        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
          ISSUE_COLORS[issue.issueType] ?? 'bg-zinc-700 text-zinc-300'
        }`}
      >
        {ISSUE_LABELS[issue.issueType] ?? issue.issueType}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 truncate">
          {issue.addressDisplay ?? 'Unbekannte Adresse'}
        </p>
        {issue.driverNotes && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">„{issue.driverNotes}"</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-zinc-500">{timeAgo(issue.createdAt)}</span>
        {!issue.resolved && (
          <button
            onClick={() => onResolve(issue.id)}
            aria-label="Problem als gelöst markieren"
            className="p-1 rounded text-green-500 hover:bg-green-900/30 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
        {issue.resolved && <CheckCircle2 className="w-4 h-4 text-green-600" />}
      </div>
    </div>
  );
}

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

export function AddressIntelligenceClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<AddressIntelligenceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'problematic' | 'issues' | 'info'>('problematic');

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/address-intelligence?action=dashboard&location_id=${locationId}`,
        );
        if (res.ok) setDashboard(await res.json());
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [locationId],
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function resolveIssue(issueId: string) {
    await fetch(`/api/delivery/admin/address-intelligence?location_id=${locationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve_issue', issue_id: issueId }),
    });
    load(true);
  }

  async function resolveByHash(addressHash: string) {
    // Alle ungelösten Issues dieser Adresse einzeln auflösen
    const issues = dashboard?.recentIssues.filter(
      (i) => i.addressHash === addressHash && !i.resolved,
    ) ?? [];
    await Promise.all(issues.map((i) => resolveIssue(i.id)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Lade Adress-Intelligenz…
      </div>
    );
  }

  const stats: AddressIntelligenceStats = dashboard?.stats ?? {
    locationId,
    totalSavedAddresses: 0,
    problematicAddresses: 0,
    issuesToday: 0,
    issuesThisWeek: 0,
    customersWithPrefs: 0,
    pctWithSpecialInstructions: 0,
  };

  const problematic = dashboard?.problematicAddresses ?? [];
  const issues = dashboard?.recentIssues ?? [];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <MapPin className="w-4 h-4 text-matcha-400" />
          Adress-Datenbank · 60s Auto-Refresh
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Gespeicherte Adressen"
          value={stats.totalSavedAddresses}
          sub={`${stats.customersWithPrefs} Kunden`}
          icon={Home}
          color="text-matcha-400"
        />
        <KpiCard
          label="Problem-Adressen"
          value={stats.problematicAddresses}
          sub="letzte 90 Tage"
          icon={AlertTriangle}
          color={stats.problematicAddresses > 0 ? 'text-red-400' : 'text-green-400'}
        />
        <KpiCard
          label="Issues heute"
          value={stats.issuesToday}
          sub={`${stats.issuesThisWeek} diese Woche`}
          icon={Clock}
          color={stats.issuesToday > 0 ? 'text-amber-400' : 'text-zinc-400'}
        />
        <KpiCard
          label="Mit Lieferhinweisen"
          value={`${stats.pctWithSpecialInstructions}%`}
          sub="aller Adressen"
          icon={Info}
          color="text-blue-400"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800/60 rounded-xl p-1 border border-zinc-700/50">
        {(
          [
            { id: 'problematic', label: `Problem-Adressen (${problematic.length})`, icon: AlertTriangle },
            { id: 'issues', label: `Issue-Log (${issues.filter((i) => !i.resolved).length} offen)`, icon: XCircle },
            { id: 'info', label: 'So funktioniert es', icon: Info },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === id
                ? 'bg-matcha-700/50 text-matcha-300 border border-matcha-600/40'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === 'problematic' ? 'Probleme' : id === 'issues' ? 'Log' : 'Info'}</span>
          </button>
        ))}
      </div>

      {/* Tab-Inhalt: Problem-Adressen */}
      {activeTab === 'problematic' && (
        <div className="space-y-3">
          {problematic.length === 0 ? (
            <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/50 p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-300 font-medium">Keine Problem-Adressen</p>
              <p className="text-xs text-zinc-500 mt-1">
                Alle Lieferadressen waren in den letzten 90 Tagen problemlos.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                Adressen mit ≥ 2 ungelösten Issues in den letzten 90 Tagen. Fahrer werden gewarnt.
              </p>
              {problematic.map((addr) => (
                <ProblematicAddressRow
                  key={addr.addressHash}
                  addr={addr}
                  onResolve={resolveByHash}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Tab-Inhalt: Issue-Log */}
      {activeTab === 'issues' && (
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-400" />
            Letzte Lieferprobleme
          </h3>
          {issues.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">
              Keine Issues in den letzten Tagen.
            </p>
          ) : (
            <div className="divide-y divide-zinc-700/40">
              {issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} onResolve={resolveIssue} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab-Inhalt: Info */}
      {activeTab === 'info' && (
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            So funktioniert die Adress-Intelligenz
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Home,
                color: 'text-matcha-400',
                title: 'Kunden speichern Präferenzen',
                desc: 'Beim Checkout können Kunden Lieferhinweise hinterlassen: Klingel, Stockwerk, Türcode, Sonderanweisungen. Diese werden für Folgebestellungen vorausgefüllt.',
              },
              {
                icon: Bell,
                color: 'text-blue-400',
                title: 'Fahrer sehen Hinweise',
                desc: 'In der Fahrer-App erscheinen Lieferhinweise prominent auf der Stop-Karte: Klingeln ja/nein, Etage, Zugangscode, spezielle Anweisungen.',
              },
              {
                icon: AlertTriangle,
                color: 'text-amber-400',
                title: 'Problem-Adressen werden erkannt',
                desc: 'Wenn Fahrer nach einem Fehlversuch ein Problem melden, wird die Adresse geloggt. Bei ≥ 2 Problemen gilt sie als "schwierig" und Fahrer werden automatisch gewarnt.',
              },
              {
                icon: Package,
                color: 'text-purple-400',
                title: 'Quality Score',
                desc: 'Jede Adresse erhält einen Qualitäts-Score (0–100). 100 = problemlos, < 50 = häufige Probleme. Der Score fließt zukünftig in die Dispatch-Priorisierung ein.',
              },
              {
                icon: BellOff,
                color: 'text-red-400',
                title: 'Automatische Fahrer-Warnung',
                desc: 'Bei Problem-Adressen erscheint ein rotes Warn-Badge auf der Stop-Karte in der Fahrer-App, bevor der Fahrer ankommt.',
              },
              {
                icon: CheckCircle2,
                color: 'text-green-400',
                title: 'Issues lösen',
                desc: 'Sobald ein Adressproblem behoben wurde (z.B. Türcode aktualisiert), können Issues als gelöst markiert werden. Der Score verbessert sich automatisch.',
              },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-3">
                <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
