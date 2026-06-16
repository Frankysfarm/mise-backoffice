'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock, CheckCircle2, XCircle, RefreshCw, Zap,
  Users, TrendingUp, AlertTriangle, Shield, Loader2,
  ChevronDown, ChevronUp, Clock, CalendarPlus, SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftItem {
  id: string;
  driverId: string;
  driverName: string;
  driverVehicle: string;
  reliabilityScore: number;
  driverRank: number;
  shiftDate: string;
  startHour: number;
  endHour: number;
  driversNeeded: number;
  coverageGap: number;
  expectedOrders: number;
  isPeak: boolean;
  status: 'pending' | 'applied' | 'skipped';
}

interface ShiftDraft {
  id: string;
  status: 'pending' | 'applied' | 'discarded';
  gapsFound: number;
  shiftsProposed: number;
  coverageBefore: number;
  coverageAfter: number;
  appliedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: DraftItem[];
  itemsPending: number;
  itemsApplied: number;
  itemsSkipped: number;
  earliestDate: string | null;
  latestDate: string | null;
}

interface Dashboard {
  pendingDraftId: string | null;
  totalDrafts: number;
  appliedDrafts: number;
  shiftsCreated: number;
  coverageGapsCurrent: number;
  recentDrafts: Array<{
    id: string;
    status: string;
    shiftsProposed: number;
    coverageBefore: number;
    coverageAfter: number;
    createdAt: string;
    appliedAt: string | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function reliabilityColor(score: number): string {
  if (score >= 80) return 'text-emerald-700 bg-emerald-50';
  if (score >= 60) return 'text-blue-700 bg-blue-50';
  if (score >= 40) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

function coverageBar(before: number, after: number) {
  const improvement = after - before;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>Vorher: {before}%</span>
        <span className="font-medium text-emerald-700">Nachher: {after}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full flex">
          <div className="bg-blue-400 h-full" style={{ width: `${before}%` }} />
          <div className="bg-emerald-500 h-full" style={{ width: `${improvement}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Draft Item Row ─────────────────────────────────────────────────────────────

function DraftItemRow({
  item,
  onSkip,
  skipping,
}: {
  item: DraftItem;
  onSkip: (id: string) => void;
  skipping: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 text-sm border-b border-gray-100 last:border-0',
        item.status === 'skipped' && 'opacity-40',
        item.status === 'applied' && 'bg-emerald-50',
      )}
    >
      {/* Driver */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{item.driverName}</span>
          {item.isPeak && (
            <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
              Peak
            </span>
          )}
          {item.driverRank === 1 && (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
              ★ Top
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{item.driverVehicle}</div>
      </div>

      {/* Shift time */}
      <div className="text-center shrink-0">
        <div className="font-mono text-gray-800 font-medium">
          {fmtHour(item.startHour)} – {fmtHour(item.endHour)}
        </div>
        <div className="text-xs text-gray-500">{item.endHour - item.startHour}h Schicht</div>
      </div>

      {/* Orders */}
      <div className="text-center w-16 shrink-0">
        <div className="text-gray-800 font-medium">{item.expectedOrders}</div>
        <div className="text-xs text-gray-500">Bestellungen</div>
      </div>

      {/* Reliability */}
      <div className="shrink-0">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', reliabilityColor(item.reliabilityScore))}>
          {item.reliabilityScore}%
        </span>
      </div>

      {/* Status / action */}
      <div className="shrink-0 w-20 text-right">
        {item.status === 'applied' && (
          <span className="text-xs text-emerald-700 font-medium flex items-center gap-1 justify-end">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Erstellt
          </span>
        )}
        {item.status === 'skipped' && (
          <span className="text-xs text-gray-400">Übersprungen</span>
        )}
        {item.status === 'pending' && (
          <button
            onClick={() => onSkip(item.id)}
            disabled={skipping}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 justify-end transition-colors"
            title="Überspringen"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

// ── Day Group ─────────────────────────────────────────────────────────────────

function DayGroup({
  date,
  items,
  onSkip,
  skipping,
}: {
  date: string;
  items: DraftItem[];
  onSkip: (id: string) => void;
  skipping: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const pending = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarClock className="h-4 w-4 text-gray-500" />
          <span className="font-medium text-gray-800">{fmtDate(date)}</span>
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            {items.length} Schichten
          </span>
          {pending > 0 && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {pending} ausstehend
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {expanded && (
        <div>
          {items.map((item) => (
            <DraftItemRow key={item.id} item={item} onSkip={onSkip} skipping={skipping} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AutoShiftGeneratorClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [draft, setDraft]         = useState<ShiftDraft | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying]   = useState(false);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [tab, setTab]             = useState<'draft' | 'history'>('draft');
  const [msg, setMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, draftRes] = await Promise.all([
        fetch(`/api/delivery/admin/auto-shift-generator?location_id=${locationId}&action=dashboard`),
        fetch(`/api/delivery/admin/auto-shift-generator?location_id=${locationId}&action=pending_draft`),
      ]);
      const dashJson  = await dashRes.json();
      const draftJson = await draftRes.json();
      if (dashJson.ok)  setDashboard(dashJson.data);
      if (draftJson.ok) setDraft(draftJson.data);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/delivery/admin/auto-shift-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_draft', location_id: locationId }),
      });
      const json = await res.json();
      if (json.ok) {
        showMsg(`Entwurf erstellt: ${json.data.shiftsProposed} Schichten vorgeschlagen`, true);
        await load();
        setTab('draft');
      } else {
        showMsg('Fehler beim Generieren', false);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleApply() {
    if (!draft) return;
    setApplying(true);
    try {
      const res = await fetch('/api/delivery/admin/auto-shift-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply_draft', draft_id: draft.id, location_id: locationId }),
      });
      const json = await res.json();
      if (json.ok) {
        showMsg(`${json.data.shiftsCreated} Schichten in Schichtplan übertragen ✓`, true);
        await load();
      } else {
        showMsg('Fehler beim Übertragen', false);
      }
    } finally {
      setApplying(false);
    }
  }

  async function handleDiscard() {
    if (!draft) return;
    const res = await fetch('/api/delivery/admin/auto-shift-generator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discard_draft', draft_id: draft.id, location_id: locationId }),
    });
    const json = await res.json();
    if (json.ok) {
      showMsg('Entwurf verworfen', true);
      setDraft(null);
      await load();
    }
  }

  async function handleSkip(itemId: string) {
    setSkippingId(itemId);
    try {
      const res = await fetch('/api/delivery/admin/auto-shift-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip_item', item_id: itemId, location_id: locationId }),
      });
      const json = await res.json();
      if (json.ok && draft) {
        setDraft((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) => (i.id === itemId ? { ...i, status: 'skipped' as const } : i)),
                itemsPending: prev.itemsPending - 1,
                itemsSkipped: prev.itemsSkipped + 1,
              }
            : prev,
        );
      }
    } finally {
      setSkippingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Lade Schicht-Generator…
      </div>
    );
  }

  // Group draft items by date
  const itemsByDate = new Map<string, DraftItem[]>();
  for (const item of draft?.items ?? []) {
    if (!itemsByDate.has(item.shiftDate)) itemsByDate.set(item.shiftDate, []);
    itemsByDate.get(item.shiftDate)!.push(item);
  }

  const hasPendingItems = (draft?.itemsPending ?? 0) > 0;

  return (
    <div className="space-y-6 pb-12">

      {/* Toast */}
      {msg && (
        <div className={cn(
          'fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2',
          msg.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white',
        )}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Aktuelle Lücken"
          value={dashboard?.coverageGapsCurrent ?? '–'}
          sub="nächste 7 Tage"
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          color="bg-amber-50"
        />
        <KpiCard
          label="Entwürfe gesamt"
          value={dashboard?.totalDrafts ?? 0}
          sub={`${dashboard?.appliedDrafts ?? 0} angewandt`}
          icon={<CalendarPlus className="h-4 w-4 text-blue-600" />}
          color="bg-blue-50"
        />
        <KpiCard
          label="Schichten erstellt"
          value={dashboard?.shiftsCreated ?? 0}
          sub="durch Auto-Generator"
          icon={<Users className="h-4 w-4 text-violet-600" />}
          color="bg-violet-50"
        />
        <KpiCard
          label="Ausstehend"
          value={draft?.status === 'pending' ? (draft.itemsPending) : 0}
          sub={draft?.status === 'pending' ? 'im aktuellen Entwurf' : 'kein Entwurf aktiv'}
          icon={<Clock className="h-4 w-4 text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      {/* Action Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Auto-Schicht-Generator</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Analysiert Kapazitäts-Lücken und schlägt Schichten mit verfügbaren Fahrern vor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {draft?.status === 'pending' && (
            <button
              onClick={handleDiscard}
              className="text-sm px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Verwerfen
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generiere…</>
            ) : (
              <><Zap className="h-4 w-4" /> Neuen Entwurf generieren</>
            )}
          </button>
          {draft?.status === 'pending' && hasPendingItems && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {applying ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Überträgt…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Alle {draft.itemsPending} übertragen</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        {(['draft', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'pb-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'draft' ? 'Aktueller Entwurf' : 'Verlauf'}
          </button>
        ))}
      </div>

      {/* Draft Tab */}
      {tab === 'draft' && (
        <div>
          {!draft || draft.status !== 'pending' ? (
            <div className="text-center py-16 text-gray-400">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Kein aktiver Entwurf</p>
              <p className="text-sm mt-1">Klicke auf "Neuen Entwurf generieren", um Schichten aus dem Kapazitätsplan zu erstellen.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Draft Summary */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Entwurf vom {fmtDateTime(draft.createdAt)}</h3>
                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                      Ausstehend
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{draft.gapsFound} Lücken · {draft.shiftsProposed} Schichten</div>
                </div>
                <div className="max-w-xs">
                  {coverageBar(draft.coverageBefore, draft.coverageAfter)}
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {draft.earliestDate && fmtDate(draft.earliestDate)} –{' '}
                    {draft.latestDate && fmtDate(draft.latestDate)}
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {draft.itemsPending} ausstehend
                  </span>
                  {draft.itemsSkipped > 0 && (
                    <span className="text-gray-400">{draft.itemsSkipped} übersprungen</span>
                  )}
                </div>
              </div>

              {/* Items by day */}
              {itemsByDate.size === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Keine Schichten im Entwurf.</p>
              ) : (
                [...itemsByDate.entries()].map(([date, items]) => (
                  <DayGroup
                    key={date}
                    date={date}
                    items={items}
                    onSkip={handleSkip}
                    skipping={skippingId !== null}
                  />
                ))
              )}

              {/* Reliability legend */}
              <div className="bg-gray-50 rounded-xl p-3 flex flex-wrap gap-3 text-xs text-gray-600">
                <span className="font-medium">Zuverlässigkeit:</span>
                <span className={cn('px-2 py-0.5 rounded-full', reliabilityColor(90))}>≥80% Sehr gut</span>
                <span className={cn('px-2 py-0.5 rounded-full', reliabilityColor(70))}>≥60% Gut</span>
                <span className={cn('px-2 py-0.5 rounded-full', reliabilityColor(50))}>≥40% Mittel</span>
                <span className={cn('px-2 py-0.5 rounded-full', reliabilityColor(20))}>{'<'}40% Kritisch</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {!dashboard?.recentDrafts.length ? (
            <p className="text-center text-sm text-gray-400 py-10">Noch keine Entwürfe.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2.5 font-medium">Erstellt</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Schichten</th>
                  <th className="px-4 py-2.5 font-medium">Abdeckung</th>
                  <th className="px-4 py-2.5 font-medium">Angewandt</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentDrafts.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{fmtDateTime(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        d.status === 'applied'   ? 'bg-emerald-100 text-emerald-700' :
                        d.status === 'pending'   ? 'bg-amber-100 text-amber-700' :
                                                   'bg-gray-100 text-gray-500',
                      )}>
                        {d.status === 'applied' ? 'Angewandt' : d.status === 'pending' ? 'Ausstehend' : 'Verworfen'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.shiftsProposed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{d.coverageBefore}%</span>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="font-medium text-emerald-700">{d.coverageAfter}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.appliedAt ? fmtDateTime(d.appliedAt) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1">
        <p className="font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> Wie funktioniert der Generator?</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs">
          <li>Liest Kapazitätslücken aus dem 7-Tage-Plan (Phase 207)</li>
          <li>Gruppiert aufeinanderfolgende Lücken-Stunden zu Schichtblöcken (max. 8h)</li>
          <li>Wählt verfügbare Fahrer ohne Doppelbuchung, sortiert nach Zuverlässigkeits-Score</li>
          <li>Manager überprüft Entwurf, kann Schichten überspringen oder alle auf einmal übertragen</li>
          <li>Angewandte Schichten erscheinen sofort im Schichtplan mit Status "scheduled"</li>
        </ul>
      </div>
    </div>
  );
}
