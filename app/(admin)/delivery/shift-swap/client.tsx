'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  RefreshCw, CheckCircle2, XCircle, ArrowLeftRight,
  History, Settings, Clock, Users,
} from 'lucide-react';

interface SwapStats {
  pendingCount: number;
  completed30d: number;
  declined30d: number;
  expiredTotal: number;
  avgCompletionHours: number | null;
}

interface SwapRequest {
  id: string;
  locationId: string;
  requesterDriverId: string;
  requesterShiftId: string;
  targetDriverId: string | null;
  acceptedByDriverId: string | null;
  status: string;
  adminApprovalRequired: boolean;
  adminApprovedAt: string | null;
  adminRejectionReason: string | null;
  notes: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  // detail fields (from open view)
  requesterName?: string | null;
  requesterVehicle?: string | null;
  shiftStart?: string;
  shiftEnd?: string;
  targetName?: string | null;
}

interface SwapConfig {
  enabled: boolean;
  requireAdminApproval: boolean;
  maxSwapsPerDriverMonth: number;
  minNoticeHours: number;
  allowOpenRequests: boolean;
}

type Tab = 'open' | 'history' | 'config';

const STATUS_LABEL: Record<string, string> = {
  pending:   'Offen',
  accepted:  'Angenommen',
  rejected:  'Abgelehnt',
  cancelled: 'Storniert',
  completed: 'Abgeschlossen',
  expired:   'Abgelaufen',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   'text-amber-700 bg-amber-50 border-amber-200',
  accepted:  'text-blue-700 bg-blue-50 border-blue-200',
  rejected:  'text-red-700 bg-red-50 border-red-200',
  cancelled: 'text-muted-foreground bg-muted border-border',
  completed: 'text-green-700 bg-green-50 border-green-200',
  expired:   'text-muted-foreground bg-muted border-border',
};

export function ShiftSwapClient({ locationId }: { locationId: string }) {
  const [tab, setTab]             = useState<Tab>('open');
  const [stats, setStats]         = useState<SwapStats | null>(null);
  const [open, setOpen]           = useState<SwapRequest[]>([]);
  const [history, setHistory]     = useState<SwapRequest[]>([]);
  const [config, setConfig]       = useState<SwapConfig | null>(null);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [cfgSaving, setCfgSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/delivery/admin/shift-swap?action=dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setStats(d.stats as SwapStats);
        setOpen(d.openRequests as SwapRequest[]);
        setHistory(d.recentCompleted as SwapRequest[]);
        setConfig(d.config as SwapConfig);
      })
      .catch(() => setError('Dashboard konnte nicht geladen werden'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [locationId]);

  const adminAct = async (swapId: string, action: 'approve' | 'reject', reason?: string) => {
    setActing(swapId);
    setError(null);
    const body: Record<string, unknown> = { action, swap_id: swapId };
    if (reason) body.reason = reason;

    const res = await fetch('/api/delivery/admin/shift-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setOpen(prev => prev.filter(r => r.id !== swapId));
      setStats(prev => prev ? {
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
        completed30d: action === 'approve' ? prev.completed30d + 1 : prev.completed30d,
        declined30d:  action === 'reject'  ? prev.declined30d  + 1 : prev.declined30d,
      } : prev);
    } else {
      const j = await res.json() as { error?: string };
      setError(j.error ?? 'Fehler');
    }
    setActing(null);
  };

  const saveConfig = async (patch: Partial<SwapConfig>) => {
    if (!config) return;
    setCfgSaving(true);
    setError(null);
    const updated = { ...config, ...patch };
    const res = await fetch('/api/delivery/admin/shift-swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:                    'save_config',
        enabled:                   updated.enabled,
        require_admin_approval:    updated.requireAdminApproval,
        max_swaps_per_driver_month: updated.maxSwapsPerDriverMonth,
        min_notice_hours:          updated.minNoticeHours,
        allow_open_requests:       updated.allowOpenRequests,
      }),
    });
    if (res.ok) {
      setConfig(updated);
    } else {
      const j = await res.json() as { error?: string };
      setError(j.error ?? 'Speichern fehlgeschlagen');
    }
    setCfgSaving(false);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cn('rounded-xl border px-4 py-3', (stats?.pendingCount ?? 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border')}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Offen</div>
          <div className={cn('font-display text-3xl font-black', (stats?.pendingCount ?? 0) > 0 ? 'text-amber-700' : '')}>
            {loading ? '–' : (stats?.pendingCount ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-200 px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgeschlossen (30T)</div>
          <div className="font-display text-3xl font-black text-green-700">
            {loading ? '–' : (stats?.completed30d ?? 0)}
          </div>
        </div>
        <div className="rounded-xl border bg-card border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Abgelehnt (30T)</div>
          <div className="font-display text-3xl font-black">{loading ? '–' : (stats?.declined30d ?? 0)}</div>
        </div>
        <div className="rounded-xl border bg-card border-border px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Bearbeitungszeit</div>
          <div className="font-display text-3xl font-black">
            {loading ? '–' : (stats?.avgCompletionHours != null ? `${stats.avgCompletionHours}h` : '–')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          ['open',    'Offene Anfragen', ArrowLeftRight],
          ['history', 'Verlauf',         History],
          ['config',  'Konfiguration',   Settings],
        ] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition',
              tab === t
                ? 'border-matcha-600 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            <Icon className="h-3.5 w-3.5" />
            {label}
            {t === 'open' && (stats?.pendingCount ?? 0) > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 leading-none">
                {stats!.pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Open */}
      {tab === 'open' && (
        <div>
          {loading && (
            <div className="flex justify-center py-12 text-muted-foreground text-sm">Lade…</div>
          )}
          {!loading && open.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <ArrowLeftRight className="h-8 w-8 opacity-30" />
              <span className="text-sm">Keine offenen Tausch-Anfragen</span>
            </div>
          )}
          {!loading && open.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b font-display font-bold text-sm">
                Offene Anfragen ({open.length})
              </div>
              <div className="divide-y divide-border">
                {open.map(req => (
                  <div key={req.id} className="px-4 py-4">
                    <div className="flex items-start gap-4">
                      <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-black shrink-0">
                        {(req.requesterName ?? 'F').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{req.requesterName ?? req.requesterDriverId.slice(0, 8)}</span>
                          {req.requesterVehicle && (
                            <span className="text-xs text-muted-foreground">{req.requesterVehicle}</span>
                          )}
                          {req.adminApprovalRequired && (
                            <span className="rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5">
                              Admin-Genehmigung nötig
                            </span>
                          )}
                        </div>
                        {req.shiftStart && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            Schicht: {fmt(req.shiftStart)} – {fmtTime(req.shiftEnd ?? '')}
                          </div>
                        )}
                        {req.targetName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Users className="h-3 w-3" />
                            Ziel: {req.targetName}
                          </div>
                        )}
                        {!req.targetDriverId && (
                          <div className="text-xs text-blue-600 mt-0.5">Offene Anfrage (alle Fahrer)</div>
                        )}
                        {req.acceptedByDriverId && !req.adminApprovedAt && (
                          <div className="text-xs text-green-700 mt-0.5 font-medium">
                            ✓ Von Fahrer angenommen — wartet auf Admin-Genehmigung
                          </div>
                        )}
                        {req.notes && (
                          <div className="text-xs text-muted-foreground italic mt-1">„{req.notes}"</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Erstellt: {fmt(req.createdAt)} · Läuft ab: {fmt(req.expiresAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => adminAct(req.id, 'approve')}
                          disabled={acting === req.id}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Genehmigen
                        </button>
                        <button onClick={() => adminAct(req.id, 'reject', 'Abgelehnt')}
                          disabled={acting === req.id}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition">
                          <XCircle className="h-3.5 w-3.5" />
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div>
          {loading && <div className="flex justify-center py-12 text-muted-foreground text-sm">Lade…</div>}
          {!loading && history.length === 0 && (
            <div className="flex justify-center py-16 text-muted-foreground text-sm">Kein Verlauf vorhanden</div>
          )}
          {!loading && history.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b font-display font-bold text-sm">
                Letzte {history.length} Anfragen
              </div>
              <div className="divide-y divide-border">
                {history.map(req => (
                  <div key={req.id} className="px-4 py-3 flex items-center gap-3">
                    <span className={cn('text-[10px] font-bold rounded-full border px-2 py-0.5', STATUS_COLOR[req.status] ?? STATUS_COLOR.cancelled)}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                    <div className="flex-1 min-w-0 text-sm">
                      Anfrage von {req.requesterDriverId.slice(0, 8)}
                      {req.adminRejectionReason && (
                        <span className="text-xs text-muted-foreground ml-2">— {req.adminRejectionReason}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {fmt(req.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Config */}
      {tab === 'config' && config && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-display font-bold text-sm">Konfiguration</div>
          <div className="p-4 space-y-5">
            {/* Toggle: enabled */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Schicht-Tausch aktiviert</div>
                <div className="text-xs text-muted-foreground">Fahrer können Tausch-Anfragen stellen</div>
              </div>
              <button onClick={() => saveConfig({ enabled: !config.enabled })} disabled={cfgSaving}
                className={cn('relative inline-flex h-6 w-11 rounded-full transition', config.enabled ? 'bg-green-600' : 'bg-muted-foreground/30', cfgSaving && 'opacity-50')}>
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-md transition mt-0.5', config.enabled ? 'translate-x-5.5' : 'translate-x-0.5')} />
              </button>
            </div>

            {/* Toggle: require_admin */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Admin-Genehmigung erforderlich</div>
                <div className="text-xs text-muted-foreground">Tausch wird erst nach Admin-OK wirksam</div>
              </div>
              <button onClick={() => saveConfig({ requireAdminApproval: !config.requireAdminApproval })} disabled={cfgSaving}
                className={cn('relative inline-flex h-6 w-11 rounded-full transition', config.requireAdminApproval ? 'bg-green-600' : 'bg-muted-foreground/30', cfgSaving && 'opacity-50')}>
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-md transition mt-0.5', config.requireAdminApproval ? 'translate-x-5.5' : 'translate-x-0.5')} />
              </button>
            </div>

            {/* Toggle: allow_open */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Offene Anfragen erlauben</div>
                <div className="text-xs text-muted-foreground">Fahrer können ohne Ziel-Fahrer annoncieren</div>
              </div>
              <button onClick={() => saveConfig({ allowOpenRequests: !config.allowOpenRequests })} disabled={cfgSaving}
                className={cn('relative inline-flex h-6 w-11 rounded-full transition', config.allowOpenRequests ? 'bg-green-600' : 'bg-muted-foreground/30', cfgSaving && 'opacity-50')}>
                <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-md transition mt-0.5', config.allowOpenRequests ? 'translate-x-5.5' : 'translate-x-0.5')} />
              </button>
            </div>

            {/* Numerics */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Max. Tausche/Fahrer/Monat
                </label>
                <input type="number" min={1} max={20} defaultValue={config.maxSwapsPerDriverMonth}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) saveConfig({ maxSwapsPerDriverMonth: v });
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Mindest-Vorlauf (Stunden)
                </label>
                <input type="number" min={1} max={168} defaultValue={config.minNoticeHours}
                  onBlur={e => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) saveConfig({ minNoticeHours: v });
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
