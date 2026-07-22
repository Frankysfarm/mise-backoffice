'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Target, TrendingDown, TrendingUp } from 'lucide-react';

interface SlaMetrik {
  key: string;
  label: string;
  wert: number;
  einheit: string;
  ziel: number;
  ziel_richtung: 'min' | 'max';
  erreichung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: number;
}

interface ApiData {
  metriken: SlaMetrik[];
  sla_gesamt_pct: number;
  alert_count: number;
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  metriken: [
    { key: 'puenktlichkeit', label: 'Pünktlichkeitsrate', wert: 87, einheit: '%', ziel: 90, ziel_richtung: 'min', erreichung_pct: 97, ampel: 'gelb', trend: -2 },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 28, einheit: 'Min', ziel: 30, ziel_richtung: 'max', erreichung_pct: 107, ampel: 'gruen', trend: -1 },
    { key: 'storno', label: 'Stornoquote', wert: 3.2, einheit: '%', ziel: 5, ziel_richtung: 'max', erreichung_pct: 136, ampel: 'gruen', trend: 0.4 },
    { key: 'bewertung', label: 'Ø Bewertung', wert: 4.1, einheit: '★', ziel: 4.5, ziel_richtung: 'min', erreichung_pct: 91, ampel: 'gelb', trend: -0.1 },
    { key: 'reaktionszeit', label: 'Reaktionszeit', wert: 4.8, einheit: 'Min', ziel: 3, ziel_richtung: 'max', erreichung_pct: 63, ampel: 'rot', trend: 0.8 },
  ],
  sla_gesamt_pct: 79,
  alert_count: 1,
  letzte_aktualisierung: '18:02',
};

const AMPEL_STYLE: Record<string, { bg: string; bar: string; text: string }> = {
  gruen: { bg: 'bg-emerald-50 dark:bg-emerald-950', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  gelb:  { bg: 'bg-amber-50 dark:bg-amber-950',   bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950',        bar: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
};

export function LieferdienstPhase2635LieferSlaEchtzeitCockpit() {
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/admin/liefer-sla', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {}
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  const gesamt = data.sla_gesamt_pct;
  const gesamtColor = gesamt >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : gesamt >= 70 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold text-sm">Liefer-SLA Echtzeit-Cockpit</span>
        </div>
        <div className={`text-lg font-bold ${gesamtColor}`}>{gesamt}% SLA</div>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {data.alert_count} Metrik{data.alert_count !== 1 ? 'en' : ''} unter Ziel — Sofortmaßnahmen nötig!
        </div>
      )}

      <div className="space-y-2.5">
        {data.metriken.map((m) => {
          const st = AMPEL_STYLE[m.ampel];
          const barPct = Math.min(100, m.erreichung_pct);
          const isGood = m.ampel === 'gruen';
          return (
            <div key={m.key} className={`rounded-lg p-2.5 ${st.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium">{m.label}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Ziel {m.ziel_richtung === 'max' ? '≤' : '≥'}{m.ziel}{m.einheit}</span>
                  <span className={`font-bold ${st.text}`}>{m.wert}{m.einheit}</span>
                  {m.trend !== 0 && (
                    m.trend < 0
                      ? <TrendingDown className="w-3 h-3 text-red-400" />
                      : <TrendingUp className="w-3 h-3 text-emerald-500" />
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-white/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${st.bar} transition-all`} style={{ width: `${barPct}%` }} />
              </div>
              {!isGood && (
                <div className={`text-xs mt-1 ${st.text}`}>
                  {m.erreichung_pct}% des Ziels erreicht
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>{data.metriken.filter(m => m.ampel === 'gruen').length}/{data.metriken.length} SLAs erfüllt</span>
        </div>
        <span>Stand {data.letzte_aktualisierung} Uhr</span>
      </div>
    </div>
  );
}
