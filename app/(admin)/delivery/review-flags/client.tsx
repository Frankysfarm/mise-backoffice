'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Flag, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, XCircle, UserX, Star, Search, Plus, ShieldAlert,
} from 'lucide-react';
import type { FlagStats, ReviewFlagWithDriver, ReviewFlagStatus } from '@/lib/delivery/review-flags';

interface Props {
  locationId: string;
  initialStats: FlagStats | null;
  initialFlags: ReviewFlagWithDriver[];
  drivers: { id: string; name: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDays(n: number): string {
  if (n < 1) return 'heute';
  if (n < 2) return '1 Tag';
  return `${Math.floor(n)} Tage`;
}

function ReasonBadge({ reason }: { reason: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    low_avg_14d:       { label: 'Niedriger Ø (14 Tage)', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    one_star_burst_7d: { label: '1-Stern-Burst (7 Tage)', cls: 'bg-red-100 text-red-700 border-red-200' },
    manual:            { label: 'Manuell',                cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  };
  const m = map[reason] ?? { label: reason, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${m.cls}`}>{m.label}</span>
  );
}

function StatusBadge({ status }: { status: ReviewFlagStatus }) {
  const map: Record<ReviewFlagStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    open:      { label: 'Offen',      cls: 'bg-red-100 text-red-700',    icon: <AlertTriangle className="h-3 w-3" /> },
    in_review: { label: 'In Prüfung', cls: 'bg-amber-100 text-amber-700', icon: <Search className="h-3 w-3" /> },
    resolved:  { label: 'Erledigt',   cls: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
    dismissed: { label: 'Abgewiesen', cls: 'bg-slate-100 text-slate-600', icon: <XCircle className="h-3 w-3" /> },
  };
  const m = map[status];
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${m.cls}`}>
      {m.icon}{m.label}
    </span>
  );
}

function VehicleBadge({ v }: { v: string }) {
  const icons: Record<string, string> = {
    bicycle: '🚲', moped: '🛵', car: '🚗', scooter: '🛴', ebike: '⚡', truck: '🚐',
  };
  return <span title={v}>{icons[v] ?? '🚗'}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReviewFlagsClient({ locationId, initialStats, initialFlags, drivers }: Props) {
  const [stats, setStats] = useState<FlagStats | null>(initialStats);
  const [flags, setFlags] = useState<ReviewFlagWithDriver[]>(initialFlags);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<'open' | 'history'>('open');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createDriverId, setCreateDriverId] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/review-flags?location_id=${locationId}`);
      const d = await res.json() as { stats: FlagStats; flags: ReviewFlagWithDriver[] };
      if (d.stats) setStats(d.stats);
      if (d.flags) setFlags(d.flags);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/review-flags?location_id=${locationId}&action=history`);
      const d = await res.json() as { history: Record<string, unknown>[] };
      if (d.history) setHistory(d.history);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  const switchTab = (t: 'open' | 'history') => {
    setTab(t);
    if (t === 'history' && history.length === 0) loadHistory();
  };

  const updateStatus = async (flagId: string, status: ReviewFlagStatus) => {
    const notes = notesMap[flagId];
    const res = await fetch('/api/delivery/admin/review-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', flagId, status, adminNotes: notes, location_id: locationId }),
    });
    if (res.ok) {
      setFlags((prev) => prev.filter((f) => f.id !== flagId));
      setExpandedId(null);
      await refresh();
    }
  };

  const runScan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const res = await fetch('/api/delivery/admin/review-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan', location_id: locationId }),
      });
      const d = await res.json() as { driversChecked?: number; flagged?: number };
      setScanMsg(`${d.driversChecked ?? 0} Fahrer geprüft, ${d.flagged ?? 0} neu geflaggt`);
      await refresh();
    } finally {
      setScanning(false);
    }
  };

  const createFlag = async () => {
    if (!createDriverId) return;
    setCreating(true);
    try {
      await fetch('/api/delivery/admin/review-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', driverId: createDriverId, adminNotes: createNotes, location_id: locationId }),
      });
      setShowCreate(false);
      setCreateDriverId('');
      setCreateNotes('');
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const kpis = [
    {
      label: 'Offen',
      value: stats?.openCount ?? 0,
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      cls: stats?.openCount ? 'border-red-200 bg-red-50' : '',
    },
    {
      label: 'In Prüfung',
      value: stats?.inReviewCount ?? 0,
      icon: <Search className="h-5 w-5 text-amber-500" />,
      cls: '',
    },
    {
      label: 'Erledigt (30 T.)',
      value: stats?.resolved30d ?? 0,
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      cls: '',
    },
    {
      label: 'Neu (7 Tage)',
      value: stats?.new7d ?? 0,
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      cls: '',
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Fahrer-Review Flags"
        subtitle="Automatische Qualitätswarnungen bei schlechten Bewertungen · Durchschnitt < 3.0 oder 1-Stern-Burst"
        icon={<ShieldAlert className="h-6 w-6" />}
      />

      {/* KPI Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className={`p-4 flex items-center gap-3 ${k.cls}`}>
            {k.icon}
            <div>
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {stats?.avgFlaggedRating != null && (
        <Card className="p-3 flex items-center gap-2 border-amber-200 bg-amber-50/50">
          <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
          <span className="text-sm text-amber-800">
            Ø Bewertung geflaggte Fahrer: <strong>{stats.avgFlaggedRating.toFixed(2)}</strong> / 5.0
          </span>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
          <Search className={`h-4 w-4 mr-1 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanne…' : 'Scan starten'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Manueller Flag
        </Button>
        {scanMsg && <span className="text-sm text-muted-foreground ml-2">{scanMsg}</span>}
      </div>

      {/* Manual flag modal */}
      {showCreate && (
        <Card className="p-4 border-blue-200 bg-blue-50/50">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Flag className="h-4 w-4" /> Manuellen Flag anlegen
          </h3>
          <div className="flex flex-col gap-2">
            <select
              value={createDriverId}
              onChange={(e) => setCreateDriverId(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">Fahrer auswählen…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Admin-Notiz (optional)"
              rows={2}
              className="border rounded px-3 py-1.5 text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createFlag} disabled={!createDriverId || creating}>
                {creating ? 'Erstelle…' : 'Flag erstellen'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b gap-4">
        {(['open', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'open' ? `Offen & In Prüfung (${flags.length})` : 'Verlauf (30 Tage)'}
          </button>
        ))}
      </div>

      {/* Open Flags Tab */}
      {tab === 'open' && (
        <div className="flex flex-col gap-3">
          {flags.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="font-medium">Keine offenen Flags</p>
              <p className="text-xs mt-1">Alle Fahrer haben gute Bewertungen.</p>
            </Card>
          )}
          {flags.map((f) => {
            const isExpanded = expandedId === f.id;
            return (
              <Card key={f.id} className="overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}
                  className="w-full p-4 flex items-start gap-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5">
                    <UserX className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{f.driverName || '—'}</span>
                      <VehicleBadge v={f.driverVehicle} />
                      <ReasonBadge reason={f.flagReason} />
                      <StatusBadge status={f.reviewStatus} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      {f.avgRatingWindow != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          Ø {f.avgRatingWindow.toFixed(2)} ({f.badRatingCount} schlechte)
                        </span>
                      )}
                      <span>Offen seit {fmtDays(f.daysOpen)}</span>
                      <span>Flagged {fmt(f.createdAt)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-muted/20">
                    <div className="pt-3 flex flex-col gap-3">
                      {f.adminNotes && (
                        <div className="text-sm bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">
                          <strong>Admin-Notiz:</strong> {f.adminNotes}
                        </div>
                      )}
                      <textarea
                        placeholder="Admin-Notiz hinzufügen…"
                        rows={2}
                        value={notesMap[f.id] ?? ''}
                        onChange={(e) => setNotesMap((m) => ({ ...m, [f.id]: e.target.value }))}
                        className="border rounded px-3 py-2 text-sm resize-none w-full"
                      />
                      <div className="flex flex-wrap gap-2">
                        {f.reviewStatus === 'open' && (
                          <Button size="sm" variant="outline" onClick={() => updateStatus(f.id, 'in_review')}>
                            <Search className="h-3.5 w-3.5 mr-1" />In Prüfung nehmen
                          </Button>
                        )}
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatus(f.id, 'resolved')}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Erledigen
                        </Button>
                        <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => updateStatus(f.id, 'dismissed')}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />Abweisen
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="flex flex-col gap-2">
          {history.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground text-sm">
              Keine abgeschlossenen Flags in den letzten 30 Tagen.
            </Card>
          )}
          {history.map((h, i) => (
            <Card key={i} className="p-3 flex items-center gap-3">
              <StatusBadge status={h.review_status as ReviewFlagStatus} />
              <div className="flex-1 min-w-0 text-sm">
                <ReasonBadge reason={h.flag_reason as string} />
                {h.admin_notes && (
                  <span className="text-xs text-muted-foreground ml-2">{h.admin_notes as string}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {fmt(h.updated_at as string)}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* Legend */}
      <Card className="p-4 bg-muted/30">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Trigger-Regeln</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li><strong>Niedriger Ø (14 Tage):</strong> Durchschnittsbewertung &lt; 3.0 bei ≥ 3 Ratings in den letzten 14 Tagen</li>
          <li><strong>1-Stern-Burst (7 Tage):</strong> ≥ 2 Einzel-Sterne-Bewertungen innerhalb von 7 Tagen</li>
          <li><strong>Manuell:</strong> Admin hat Fahrer manuell für Review markiert</li>
        </ul>
      </Card>
    </div>
  );
}
