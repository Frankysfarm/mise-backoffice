'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Users, Bike, Package, AlertTriangle, CheckCircle2, Zap, RefreshCw } from 'lucide-react';

interface KapazitaetsDaten {
  aktiveFahrer: number;
  maxFahrer: number;
  offeneBestellungen: number;
  inZubereitung: number;
  fertigWartend: number;
  aktiveTours: number;
  auslastungPct: number;
  status: 'ok' | 'busy' | 'overloaded';
  bottleneck: string | null;
}

function useKapazitaet(locationId?: string): { data: KapazitaetsDaten | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<KapazitaetsDaten | null>(null);
  const [loading, setLoading] = useState(false);
  const loadRef = useRef<() => void>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = locationId
        ? `/api/delivery/admin/overview?location_id=${locationId}`
        : '/api/delivery/admin/overview';
      const r = await fetch(url);
      if (r.ok) {
        const d = await r.json();
        const aktive = d.active_drivers ?? d.drivers_online ?? 0;
        const max = d.max_drivers ?? Math.max(aktive + 2, 6);
        const offen = d.open_orders ?? d.pending_orders ?? 0;
        const kochend = d.cooking_orders ?? 0;
        const fertig = d.ready_orders ?? d.ready_for_pickup ?? 0;
        const touren = d.active_tours ?? d.active_batches ?? 0;
        const load = offen + kochend;
        const capacity = Math.max(1, aktive * 3);
        const auslastung = Math.min(100, Math.round((load / capacity) * 100));
        const status: KapazitaetsDaten['status'] = auslastung >= 85 ? 'overloaded' : auslastung >= 60 ? 'busy' : 'ok';
        let bottleneck: string | null = null;
        if (fertig >= 3) bottleneck = 'Fahrer fehlen für fertige Bestellungen';
        else if (aktive === 0 && offen > 0) bottleneck = 'Kein Fahrer verfügbar';
        else if (auslastung >= 90) bottleneck = 'Maximale Kapazität fast erreicht';

        setData({ aktiveFahrer: aktive, maxFahrer: max, offeneBestellungen: offen, inZubereitung: kochend, fertigWartend: fertig, aktiveTours: touren, auslastungPct: auslastung, status, bottleneck });
      } else throw new Error('api error');
    } catch {
      // Mock data
      const aktive = Math.floor(Math.random() * 4 + 2);
      const offen = Math.floor(Math.random() * 8 + 2);
      const kochend = Math.floor(Math.random() * 5 + 1);
      const fertig = Math.floor(Math.random() * 3);
      const load = offen + kochend;
      const capacity = Math.max(1, aktive * 3);
      const auslastung = Math.min(100, Math.round((load / capacity) * 100));
      setData({
        aktiveFahrer: aktive, maxFahrer: aktive + 2, offeneBestellungen: offen,
        inZubereitung: kochend, fertigWartend: fertig, aktiveTours: aktive - 1,
        auslastungPct: auslastung,
        status: auslastung >= 85 ? 'overloaded' : auslastung >= 60 ? 'busy' : 'ok',
        bottleneck: fertig >= 2 ? 'Fahrer für fertige Bestellungen gesucht' : null,
      });
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  return { data, loading, reload: load };
}

function GaugeArc({ pct, color }: { pct: number; color: string }) {
  const r = 34;
  const circ = Math.PI * r;
  const offset = circ * (1 - Math.min(1, pct / 100));
  return (
    <svg width="88" height="50" viewBox="0 0 88 50">
      <path d="M 8 46 A 36 36 0 0 1 80 46" fill="none" stroke="#f3f4f6" strokeWidth="8" strokeLinecap="round" />
      <path
        d="M 8 46 A 36 36 0 0 1 80 46" fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={`${offset}`}
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }}
      />
    </svg>
  );
}

interface Props {
  locationId?: string;
}

export function SchichtLiveKapazitaet({ locationId }: Props) {
  const { data, loading, reload } = useKapazitaet(locationId);

  if (!data) return null;

  const gaugeColor =
    data.status === 'overloaded' ? '#ef4444' :
    data.status === 'busy' ? '#f59e0b' : '#10b981';

  const statusLabel =
    data.status === 'overloaded' ? 'Überlastet' :
    data.status === 'busy' ? 'Ausgelastet' : 'Kapazität OK';

  const statusBg =
    data.status === 'overloaded' ? 'bg-red-50 border-red-200' :
    data.status === 'busy' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';

  const statusIcon =
    data.status === 'overloaded'
      ? <AlertTriangle size={14} className="text-red-500 shrink-0 animate-pulse" />
      : data.status === 'busy'
      ? <Zap size={14} className="text-amber-500 shrink-0" />
      : <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />;

  const tiles = [
    { icon: Bike, label: 'Fahrer online', value: `${data.aktiveFahrer}/${data.maxFahrer}`, color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: Package, label: 'In Zubereitung', value: `${data.inZubereitung}`, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: CheckCircle2, label: 'Fertig & wartet', value: `${data.fertigWartend}`, color: data.fertigWartend >= 3 ? 'text-red-600' : 'text-emerald-600', bg: data.fertigWartend >= 3 ? 'bg-red-50' : 'bg-emerald-50' },
    { icon: Users, label: 'Aktive Touren', value: `${data.aktiveTours}`, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white">
        <Zap size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Live-Kapazität</span>
        <button
          onClick={reload}
          disabled={loading}
          className="p-1 rounded hover:bg-gray-100 text-muted-foreground disabled:opacity-40 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Gauge + Status */}
        <div className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', statusBg)}>
          <div className="relative shrink-0">
            <GaugeArc pct={data.auslastungPct} color={gaugeColor} />
            <div className="absolute bottom-0 inset-x-0 text-center">
              <span className="text-base font-black tabular-nums" style={{ color: gaugeColor }}>
                {data.auslastungPct}%
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {statusIcon}
              <span className="text-sm font-black text-foreground">{statusLabel}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {data.offeneBestellungen} offene Bestellungen
            </div>
            {data.bottleneck && (
              <div className="text-[11px] font-semibold text-red-600 mt-1">{data.bottleneck}</div>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={cn('rounded-xl px-3 py-2.5 flex items-center gap-2.5', bg)}>
              <Icon size={16} className={cn(color, 'shrink-0')} />
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
                <div className={cn('text-lg font-black tabular-nums leading-tight mt-0.5', color)}>
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
