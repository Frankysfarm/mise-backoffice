'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, PauseCircle, RefreshCw, Zap } from 'lucide-react';

type QueueSignalType = 'normal' | 'extended' | 'paused';

interface QueueSignal {
  locationId: string;
  signalType: QueueSignalType;
  etaExtensionMin: number;
  messageDe: string | null;
  triggerSource: string;
  setAt: string;
  expiresAt: string | null;
}

interface SignalHistoryEntry {
  id: string;
  signalType: QueueSignalType;
  etaExtensionMin: number;
  triggerSource: string;
  createdAt: string;
}

interface SignalData {
  signal: QueueSignal;
  history: SignalHistoryEntry[];
}

const SIGNAL_CONFIG: Record<QueueSignalType, { label: string; desc: string; icon: React.ReactNode; color: string }> = {
  normal: {
    label: 'Normal',
    desc: 'Normalbetrieb, keine ETA-Verlängerung',
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'border-matcha-300 bg-matcha-50 text-matcha-800',
  },
  extended: {
    label: 'Surge / Erweitert',
    desc: 'Hohe Nachfrage, ETA wird verlängert',
    icon: <Zap className="h-5 w-5" />,
    color: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  paused: {
    label: 'Pausiert',
    desc: 'Bestellannahme gestoppt',
    icon: <PauseCircle className="h-5 w-5" />,
    color: 'border-red-300 bg-red-50 text-red-800',
  },
};

export function QueueSignalClient({ locationId }: { locationId: string }) {
  void locationId;
  const [data, setData] = useState<SignalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [etaExt, setEtaExt] = useState(10);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/delivery/admin/queue-signal?action=status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.signal) setData(d as SignalData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setSignal = async (signalType: QueueSignalType) => {
    setActing(true);
    const body: Record<string, unknown> = { signal_type: signalType };
    if (signalType === 'extended') body.eta_extension_min = etaExt;
    await fetch('/api/delivery/admin/queue-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setActing(false);
    load();
  };

  const reset = async () => {
    setActing(true);
    await fetch('/api/delivery/admin/queue-signal', { method: 'DELETE' });
    setActing(false);
    load();
  };

  const currentSignal = data?.signal.signalType ?? 'normal';
  const cfg = SIGNAL_CONFIG[currentSignal];

  return (
    <div className="space-y-6">
      {/* Current status */}
      {data && (
        <div className={cn('rounded-xl border px-5 py-4 flex items-start gap-4', cfg.color)}>
          <div className="shrink-0 mt-0.5">{cfg.icon}</div>
          <div className="flex-1">
            <div className="font-display text-lg font-bold">{cfg.label}</div>
            <div className="text-sm mt-0.5">{cfg.desc}</div>
            {data.signal.etaExtensionMin > 0 && (
              <div className="text-sm font-medium mt-1">ETA +{data.signal.etaExtensionMin} Minuten verlängert</div>
            )}
            {data.signal.messageDe && (
              <div className="text-sm italic mt-1">„{data.signal.messageDe}"</div>
            )}
            <div className="text-[11px] opacity-70 mt-2">
              Gesetzt: {new Date(data.signal.setAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
              {' · Quelle: '}{data.signal.triggerSource}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="shrink-0 p-1.5 rounded-md hover:bg-black/10 transition"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      )}

      {loading && !data && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Signal-Status…</div>}

      {/* Signal Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Normal */}
        <button
          onClick={() => setSignal('normal')}
          disabled={acting || currentSignal === 'normal'}
          className={cn(
            'rounded-xl border p-4 text-left transition hover:shadow-sm disabled:opacity-60',
            currentSignal === 'normal' ? 'border-matcha-400 bg-matcha-50' : 'border-border bg-card hover:bg-muted/30',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className={cn('h-5 w-5', currentSignal === 'normal' ? 'text-matcha-700' : 'text-muted-foreground')} />
            <span className="font-bold">Normal</span>
            {currentSignal === 'normal' && <span className="ml-auto text-[11px] bg-matcha-700 text-white rounded-full px-2 py-0.5">Aktiv</span>}
          </div>
          <p className="text-sm text-muted-foreground">Normalbetrieb ohne ETA-Verlängerung</p>
        </button>

        {/* Extended */}
        <div className={cn('rounded-xl border p-4 transition', currentSignal === 'extended' ? 'border-amber-400 bg-amber-50' : 'border-border bg-card')}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className={cn('h-5 w-5', currentSignal === 'extended' ? 'text-amber-600' : 'text-muted-foreground')} />
            <span className="font-bold">Surge / Erweitert</span>
            {currentSignal === 'extended' && <span className="ml-auto text-[11px] bg-amber-600 text-white rounded-full px-2 py-0.5">Aktiv</span>}
          </div>
          <p className="text-sm text-muted-foreground mb-3">ETA verlängern bei hoher Nachfrage</p>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">+Min</label>
            <input
              type="number"
              min={5} max={60} step={5}
              value={etaExt}
              onChange={e => setEtaExt(Number(e.target.value))}
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center"
            />
          </div>
          <button
            onClick={() => setSignal('extended')}
            disabled={acting}
            className="w-full rounded-lg bg-amber-500 text-white py-1.5 text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50"
          >
            {acting ? '…' : 'Aktivieren'}
          </button>
        </div>

        {/* Paused */}
        <button
          onClick={() => setSignal('paused')}
          disabled={acting || currentSignal === 'paused'}
          className={cn(
            'rounded-xl border p-4 text-left transition hover:shadow-sm disabled:opacity-60',
            currentSignal === 'paused' ? 'border-red-400 bg-red-50' : 'border-border bg-card hover:bg-muted/30',
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <PauseCircle className={cn('h-5 w-5', currentSignal === 'paused' ? 'text-red-600' : 'text-muted-foreground')} />
            <span className="font-bold">Pausiert</span>
            {currentSignal === 'paused' && <span className="ml-auto text-[11px] bg-red-600 text-white rounded-full px-2 py-0.5">Aktiv</span>}
          </div>
          <p className="text-sm text-muted-foreground">Bestellannahme stoppen</p>
        </button>
      </div>

      {/* Reset button */}
      {currentSignal !== 'normal' && (
        <div className="flex justify-center">
          <button
            onClick={reset}
            disabled={acting}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Auf Normal zurücksetzen
          </button>
        </div>
      )}

      {/* History */}
      {data?.history && data.history.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Clock className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">Signal-Verlauf</span>
          </div>
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {data.history.map(h => (
              <div key={h.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className={cn('h-2 w-2 rounded-full shrink-0', h.signalType === 'normal' ? 'bg-matcha-500' : h.signalType === 'extended' ? 'bg-amber-500' : 'bg-red-500')} />
                <span className="text-sm font-medium">{SIGNAL_CONFIG[h.signalType].label}</span>
                {h.etaExtensionMin > 0 && <span className="text-[11px] text-muted-foreground">+{h.etaExtensionMin} Min</span>}
                <span className="text-[11px] text-muted-foreground">{h.triggerSource}</span>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {new Date(h.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
