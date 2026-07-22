'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, TrendingDown } from 'lucide-react';

interface RueckstandEntry {
  order_id: string;
  order_number: string;
  customer_name: string;
  ueberfaellig_min: number;
  items_count: number;
  ampel: 'gelb' | 'rot' | 'kritisch';
}

interface ApiData {
  rueckstand: RueckstandEntry[];
  gesamt_ueberfaellig: number;
  avg_verzoegerung_min: number;
  on_track_count: number;
}

const MOCK: ApiData = {
  rueckstand: [
    { order_id: 'o1', order_number: '#1038', customer_name: 'Maria K.', ueberfaellig_min: 2, items_count: 2, ampel: 'gelb' },
    { order_id: 'o2', order_number: '#1035', customer_name: 'Thomas B.', ueberfaellig_min: 7, items_count: 4, ampel: 'rot' },
    { order_id: 'o3', order_number: '#1033', customer_name: 'Nina S.', ueberfaellig_min: 14, items_count: 3, ampel: 'kritisch' },
  ],
  gesamt_ueberfaellig: 3,
  avg_verzoegerung_min: 7.7,
  on_track_count: 8,
};

const AMPEL_STYLE: Record<string, string> = {
  gelb: 'bg-amber-50 border-amber-400 dark:bg-amber-950 dark:border-amber-500',
  rot: 'bg-red-50 border-red-400 dark:bg-red-950 dark:border-red-500',
  kritisch: 'bg-rose-50 border-rose-500 dark:bg-rose-950 dark:border-rose-600',
};
const AMPEL_TEXT: Record<string, string> = {
  gelb: 'text-amber-700 dark:text-amber-300',
  rot: 'text-red-700 dark:text-red-300',
  kritisch: 'text-rose-700 dark:text-rose-300',
};

export function KitchenPhase3114BestellungsRueckstandBoard() {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/admin/bestellungs-rueckstand', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  const alertOn = data.gesamt_ueberfaellig >= 3;

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-rose-500" />
          <span className="font-semibold text-sm">Bestellungs-Rückstand</span>
        </div>
        {alertOn && (
          <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.gesamt_ueberfaellig} überfällig!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-rose-50 dark:bg-rose-950 p-2">
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{data.gesamt_ueberfaellig}</div>
          <div className="text-xs text-zinc-500">Überfällig</div>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-2">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.avg_verzoegerung_min.toFixed(1)}'</div>
          <div className="text-xs text-zinc-500">Ø Verzögerung</div>
        </div>
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{data.on_track_count}</div>
          <div className="text-xs text-zinc-500">Auf Kurs</div>
        </div>
      </div>

      {data.rueckstand.length === 0 ? (
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm py-2">
          <CheckCircle2 className="w-4 h-4" /> Alle Bestellungen im Zeitplan
        </div>
      ) : (
        <div className="space-y-2">
          {data.rueckstand.map((r) => (
            <div key={r.order_id} className={`rounded-lg border-l-4 px-3 py-2 ${AMPEL_STYLE[r.ampel]}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{r.order_number} · {r.customer_name}</span>
                <span className={`flex items-center gap-1 text-xs font-bold ${AMPEL_TEXT[r.ampel]}`}>
                  <Clock className="w-3 h-3" /> +{r.ueberfaellig_min}'
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{r.items_count} Artikel</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
