'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Zap, AlertTriangle, CheckCircle2, TrendingUp, Clock, Target, Flame } from 'lucide-react';

interface BestellRow {
  id: string;
  nr: string;
  deadline_ms: number;
  kochstart_ms: number;
  status: 'wartend' | 'in_arbeit' | 'fertig';
  komplexitaet: number;
  artikel_anzahl: number;
  fahrer_eta_ms: number | null;
}

interface KpiData {
  on_time_pct: number;
  avg_prep_min: number;
  kochstart_score: number;
  ueberfaellig: number;
  sync_score: number;
  fertig_ohne_fahrer: number;
}

const MOCK_BESTELLUNGEN: BestellRow[] = [
  { id: 'b1', nr: 'FF-7001', deadline_ms: Date.now() + 14 * 60000, kochstart_ms: Date.now() + 3 * 60000, status: 'wartend', komplexitaet: 3, artikel_anzahl: 4, fahrer_eta_ms: Date.now() + 13 * 60000 },
  { id: 'b2', nr: 'FF-7002', deadline_ms: Date.now() + 4 * 60000, kochstart_ms: Date.now() - 4 * 60000, status: 'in_arbeit', komplexitaet: 5, artikel_anzahl: 7, fahrer_eta_ms: Date.now() + 3 * 60000 },
  { id: 'b3', nr: 'FF-7003', deadline_ms: Date.now() - 3 * 60000, kochstart_ms: Date.now() - 12 * 60000, status: 'in_arbeit', komplexitaet: 2, artikel_anzahl: 2, fahrer_eta_ms: null },
  { id: 'b4', nr: 'FF-7004', deadline_ms: Date.now() + 20 * 60000, kochstart_ms: Date.now() + 10 * 60000, status: 'wartend', komplexitaet: 4, artikel_anzahl: 5, fahrer_eta_ms: Date.now() + 19 * 60000 },
  { id: 'b5', nr: 'FF-7005', deadline_ms: Date.now() + 2 * 60000, kochstart_ms: Date.now() - 8 * 60000, status: 'in_arbeit', komplexitaet: 1, artikel_anzahl: 1, fahrer_eta_ms: Date.now() + 1 * 60000 },
  { id: 'b6', nr: 'FF-7006', deadline_ms: Date.now() - 60000, kochstart_ms: Date.now() - 15 * 60000, status: 'fertig', komplexitaet: 3, artikel_anzahl: 3, fahrer_eta_ms: Date.now() + 5 * 60000 },
];

const MOCK_KPI: KpiData = { on_time_pct: 84, avg_prep_min: 11.8, kochstart_score: 79, ueberfaellig: 2, sync_score: 71, fertig_ohne_fahrer: 1 };

function fmtSek(ms: number, now: number) {
  const diff = Math.round((ms - now) / 1000);
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${diff < 0 ? '−' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function farbCode(restMs: number, status: string) {
  if (status === 'fertig') return { border: 'border-emerald-300', bg: 'bg-emerald-50', txt: 'text-emerald-700', bar: 'bg-emerald-500', label: 'Fertig', pulse: false };
  const sek = (restMs) / 1000;
  if (sek < 0)   return { border: 'border-red-400',    bg: 'bg-red-50',    txt: 'text-red-700',    bar: 'bg-red-500',    label: 'Überfällig', pulse: true };
  if (sek < 120) return { border: 'border-orange-400', bg: 'bg-orange-50', txt: 'text-orange-700', bar: 'bg-orange-500', label: 'Kritisch',   pulse: true };
  if (sek < 360) return { border: 'border-yellow-400', bg: 'bg-yellow-50', txt: 'text-yellow-700', bar: 'bg-yellow-400', label: 'Bald',       pulse: false };
  return              { border: 'border-emerald-200', bg: 'bg-emerald-50', txt: 'text-emerald-600', bar: 'bg-emerald-400', label: 'OK',        pulse: false };
}

function scoreFarbe(score: number) {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function KitchenPhase3957SmartTimingKochzeitUltraCockpit({ locationId }: { locationId: string | null }) {
  const [now, setNow] = useState(Date.now());
  const [bestellungen, setBestellungen] = useState<BestellRow[]>(MOCK_BESTELLUNGEN);
  const [kpi, setKpi] = useState<KpiData>(MOCK_KPI);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.orders)) setBestellungen(d.orders);
        if (d.kpi) setKpi(d.kpi);
      }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(id); }, []);

  const sorted = [...bestellungen].sort((a, b) => a.deadline_ms - b.deadline_ms);
  const ueberfaellig = sorted.filter(o => o.status !== 'fertig' && now > o.deadline_ms);

  return (
    <div className="rounded-xl border border-violet-100 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Smart-Timing · Kochzeit Ultra Cockpit</span>
        {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />}
        {ueberfaellig.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> {ueberfaellig.length} überfällig
          </span>
        )}
        {kpi.fertig_ohne_fahrer > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            <Clock className="h-3 w-3" /> {kpi.fertig_ohne_fahrer} wartet
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: CheckCircle2, label: 'Pünktlich', value: `${kpi.on_time_pct}%`, color: kpi.on_time_pct >= 85 ? 'text-emerald-600' : 'text-red-600' },
          { icon: Clock, label: 'Ø Prep', value: `${kpi.avg_prep_min.toFixed(1)} min`, color: 'text-slate-700' },
          { icon: Zap, label: 'Kochstart', value: `${kpi.kochstart_score}`, color: scoreFarbe(kpi.kochstart_score) },
          { icon: AlertTriangle, label: 'Überfällig', value: `${kpi.ueberfaellig}`, color: kpi.ueberfaellig > 0 ? 'text-red-600' : 'text-emerald-600' },
          { icon: TrendingUp, label: 'Sync-Score', value: `${kpi.sync_score}`, color: scoreFarbe(kpi.sync_score) },
          { icon: Target, label: 'Ziel ≥85%', value: `${kpi.on_time_pct >= 85 ? '✓' : '✗'}`, color: kpi.on_time_pct >= 85 ? 'text-emerald-600' : 'text-red-500' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Icon className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
            <div className={`text-sm font-bold tabular-nums ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Kochstart Score Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Kochstart-Score</span>
          <span className={scoreFarbe(kpi.kochstart_score)}>{kpi.kochstart_score}/100</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${kpi.kochstart_score >= 85 ? 'bg-emerald-500' : kpi.kochstart_score >= 70 ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${kpi.kochstart_score}%` }}
          />
        </div>
      </div>

      {/* Bestellungs-Kacheln */}
      <div className="space-y-1.5">
        {sorted.map((b) => {
          const restMs = b.deadline_ms - now;
          const farbe = farbCode(restMs, b.status);
          const kochMs = b.kochstart_ms - now;
          const nochNichtGestartet = b.status === 'wartend' && kochMs > 0;
          const barPct = Math.max(0, Math.min(100, ((b.deadline_ms - now) / (b.deadline_ms - b.kochstart_ms)) * 100));

          return (
            <div
              key={b.id}
              className={`rounded-lg border ${farbe.border} ${farbe.bg} px-3 py-2 ${farbe.pulse ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-700">{b.nr}</span>
                  <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${farbe.bg} ${farbe.txt} border ${farbe.border}`}>
                    {farbe.label}
                  </span>
                  {b.artikel_anzahl > 0 && (
                    <span className="text-[10px] text-slate-500">{b.artikel_anzahl} Art.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {nochNichtGestartet && (
                    <span className="text-[10px] text-slate-500">Kochstart {fmtSek(b.kochstart_ms, now)}</span>
                  )}
                  <span className={`font-mono text-sm font-bold tabular-nums ${farbe.txt}`}>
                    {fmtSek(b.deadline_ms, now)}
                  </span>
                  {b.fahrer_eta_ms && (
                    <span className="text-[10px] text-slate-400">
                      🚴 {fmtSek(b.fahrer_eta_ms, now)}
                    </span>
                  )}
                </div>
              </div>
              {b.status !== 'fertig' && (
                <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full ${farbe.bar} rounded-full transition-all duration-1000`} style={{ width: `${barPct}%` }} />
                </div>
              )}
              {b.komplexitaet >= 4 && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-600">
                  <Flame className="h-3 w-3" /> Hohe Komplexität – früh starten
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!locationId && (
        <div className="text-xs text-slate-400 text-center pt-1">Filiale auswählen für Live-Daten</div>
      )}
    </div>
  );
}
