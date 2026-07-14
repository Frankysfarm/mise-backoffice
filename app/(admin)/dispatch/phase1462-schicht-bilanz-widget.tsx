'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Wallet, MapPin, TrendingUp, Coffee, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1462 — Schicht-Bilanz-Widget (Dispatch)
// Phase1460-API: Kompaktes Fahrer-Bilanz-Panel mit Stopps + Verdienst + Trinkgeld-Badge;
// 30-Min-Polling; nach Phase1459.

interface FahrerBilanz {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  km_heute: number;
  verdienst_heute: number;
  trinkgeld_heute: number;
  gesamt_heute: number;
  schicht_start: string | null;
  aktiv: boolean;
}

interface BilanzData {
  fahrer: FahrerBilanz[];
  datum: string;
  gesamt_stopps: number;
  gesamt_km: number;
  gesamt_verdienst: number;
  gesamt_trinkgeld: number;
}

interface Props {
  locationId: string;
}

function fmt(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TrinkgeldBadge({ val }: { val: number }) {
  const cls = val >= 5 ? 'bg-emerald-100 text-emerald-700' : val >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500';
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cls)}>{fmt(val)} € TG</span>;
}

export function DispatchPhase1462SchichtBilanzWidget({ locationId }: Props) {
  const [data, setData] = useState<BilanzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/delivery/admin/schicht-bilanz-fahrer?location_id=${locationId}`);
      if (!res.ok) return;
      setData(await res.json());
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Schicht-Bilanz wird geladen…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const gesamtEinnahmen = data.gesamt_verdienst + data.gesamt_trinkgeld;

  return (
    <Card className="p-4 space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-sm">Schicht-Bilanz heute</span>
          <span className="text-xs text-slate-400">{data.datum}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Stopps', val: String(data.gesamt_stopps), icon: <MapPin className="w-3 h-3" /> },
          { label: 'km', val: String(data.gesamt_km), icon: <TrendingUp className="w-3 h-3" /> },
          { label: 'Verdienst', val: `${fmt(data.gesamt_verdienst)} €`, icon: <Wallet className="w-3 h-3" /> },
          { label: 'Trinkgeld', val: `${fmt(data.gesamt_trinkgeld)} €`, icon: <Coffee className="w-3 h-3" /> },
        ].map(k => (
          <div key={k.label} className="bg-slate-50 rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-center gap-1 text-slate-500">{k.icon}<span className="text-[10px]">{k.label}</span></div>
            <div className="font-bold text-sm text-slate-800">{k.val}</div>
          </div>
        ))}
      </div>

      {open && (
        <div className="space-y-2">
          {data.fahrer.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn('w-2 h-2 rounded-full shrink-0', f.aktiv ? 'bg-emerald-500' : 'bg-slate-300')} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{f.fahrer_name}</div>
                  <div className="text-[10px] text-slate-500">{f.stopps_heute} Stopps · {f.km_heute} km</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <TrinkgeldBadge val={f.trinkgeld_heute} />
                <span className="text-sm font-bold text-emerald-700">{fmt(f.gesamt_heute)} €</span>
              </div>
            </div>
          ))}

          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Gesamt: <strong className="text-slate-700">{fmt(gesamtEinnahmen)} €</strong></span>
            {lastUpdate && <span>Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
