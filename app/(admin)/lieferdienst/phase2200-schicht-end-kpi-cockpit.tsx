'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CheckCircle2, Euro, Clock, Star, Bike, TrendingUp, TrendingDown, Target,
  BarChart2, Package,
} from 'lucide-react';

interface SchichtKpis {
  umsatz: number;
  umsatzZiel: number;
  bestellungen: number;
  bestellungenZiel: number;
  avgLieferzeitMin: number;
  lieferzeitZielMin: number;
  onTimePct: number;
  stornoPct: number;
  aktiveFahrer: number;
  abgeschlosseneTouren: number;
  avgFahrerScore: number;
  trinkgeldGesamt: number;
}

const MOCK: SchichtKpis = {
  umsatz: 1842, umsatzZiel: 2000,
  bestellungen: 67, bestellungenZiel: 75,
  avgLieferzeitMin: 28.4, lieferzeitZielMin: 30,
  onTimePct: 87, stornoPct: 3.2,
  aktiveFahrer: 5, abgeschlosseneTouren: 14,
  avgFahrerScore: 4.7, trinkgeldGesamt: 94.5,
};

function KpiTile({
  label, value, sub, target, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; target?: number; icon: React.ElementType; accent: string;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-3 relative overflow-hidden`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent} rounded-l-xl`} />
      <div className="pl-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-[10px] text-stone-500 font-medium">{label}</span>
        </div>
        <p className="text-xl font-black text-stone-900 leading-none">{value}</p>
        {sub && <p className="text-[10px] text-stone-400 mt-0.5">{sub}</p>}
        {target != null && (
          <div className="mt-1.5 w-full bg-stone-100 rounded-full h-1">
            <div
              className={`h-1 rounded-full ${accent}`}
              style={{ width: `${Math.min((parseFloat(value.replace(/[^\d.]/g, '')) / target) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function LieferdienstPhase2200SchichtEndKpiCockpit() {
  const [kpis, setKpis] = useState<SchichtKpis>(MOCK);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('schicht_kpis_aktuell')
        .select('*')
        .single();
      if (data) {
        setKpis({
          umsatz: data.umsatz ?? MOCK.umsatz,
          umsatzZiel: data.umsatz_ziel ?? MOCK.umsatzZiel,
          bestellungen: data.bestellungen ?? MOCK.bestellungen,
          bestellungenZiel: data.bestellungen_ziel ?? MOCK.bestellungenZiel,
          avgLieferzeitMin: data.avg_lieferzeit_min ?? MOCK.avgLieferzeitMin,
          lieferzeitZielMin: data.lieferzeit_ziel_min ?? MOCK.lieferzeitZielMin,
          onTimePct: data.on_time_pct ?? MOCK.onTimePct,
          stornoPct: data.storno_pct ?? MOCK.stornoPct,
          aktiveFahrer: data.aktive_fahrer ?? MOCK.aktiveFahrer,
          abgeschlosseneTouren: data.abgeschlossene_touren ?? MOCK.abgeschlosseneTouren,
          avgFahrerScore: data.avg_fahrer_score ?? MOCK.avgFahrerScore,
          trinkgeldGesamt: data.trinkgeld_gesamt ?? MOCK.trinkgeldGesamt,
        });
      }
    } catch {
      // keep mock
    }
    setLastUpdate(new Date());
  }, [supabase]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  const umsatzPct = Math.round((kpis.umsatz / kpis.umsatzZiel) * 100);
  const bestellungenPct = Math.round((kpis.bestellungen / kpis.bestellungenZiel) * 100);
  const lieferzeitOk = kpis.avgLieferzeitMin <= kpis.lieferzeitZielMin;

  return (
    <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-stone-600" />
          <span className="text-sm font-bold text-stone-800">Schicht-KPI Cockpit</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            umsatzPct >= 95 ? 'bg-emerald-100 text-emerald-700' :
            umsatzPct >= 80 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {umsatzPct}% Ziel
          </span>
        </div>
        <span className="text-[10px] text-stone-400">
          {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <KpiTile
          label="Umsatz"
          value={`€${kpis.umsatz.toFixed(0)}`}
          sub={`Ziel: €${kpis.umsatzZiel}`}
          target={kpis.umsatzZiel}
          icon={Euro}
          accent="bg-emerald-500"
        />
        <KpiTile
          label="Bestellungen"
          value={String(kpis.bestellungen)}
          sub={`Ziel: ${kpis.bestellungenZiel}`}
          target={kpis.bestellungenZiel}
          icon={Package}
          accent="bg-blue-500"
        />
        <KpiTile
          label="Lieferzeit Ø"
          value={`${kpis.avgLieferzeitMin.toFixed(1)} Min`}
          sub={lieferzeitOk ? `Ziel: ${kpis.lieferzeitZielMin} Min ✓` : `Ziel: ${kpis.lieferzeitZielMin} Min ✗`}
          icon={Clock}
          accent={lieferzeitOk ? 'bg-emerald-500' : 'bg-amber-500'}
        />
        <KpiTile
          label="Pünktlich"
          value={`${kpis.onTimePct}%`}
          sub={`Storno: ${kpis.stornoPct}%`}
          icon={Target}
          accent={kpis.onTimePct >= 85 ? 'bg-emerald-500' : 'bg-amber-500'}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl border p-2.5 text-center">
          <Bike className="w-4 h-4 text-stone-500 mx-auto mb-1" />
          <p className="text-lg font-black text-stone-900">{kpis.aktiveFahrer}</p>
          <p className="text-[10px] text-stone-400">Fahrer aktiv</p>
        </div>
        <div className="bg-white rounded-xl border p-2.5 text-center">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-black text-stone-900">{kpis.abgeschlosseneTouren}</p>
          <p className="text-[10px] text-stone-400">Touren fertig</p>
        </div>
        <div className="bg-white rounded-xl border p-2.5 text-center">
          <Star className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-black text-stone-900">{kpis.avgFahrerScore.toFixed(1)}</p>
          <p className="text-[10px] text-stone-400">Ø Bewertung</p>
        </div>
      </div>

      {kpis.trinkgeldGesamt > 0 && (
        <div className="mt-2 bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">Trinkgeld Schicht</p>
            <p className="text-[10px] text-amber-600">€{kpis.trinkgeldGesamt.toFixed(2)} gesamt</p>
          </div>
        </div>
      )}
    </div>
  );
}
