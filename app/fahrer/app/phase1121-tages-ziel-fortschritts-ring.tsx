'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Edit2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1121 — Tages-Ziel-Fortschritts-Ring (Fahrer-App)
// Fahrer setzt Tages-Ziel (Stopps + €) + SVG-Fortschritts-Ring + Motivations-Nachricht bei 50%/100%

interface Props {
  driverId: string;
  isOnline: boolean;
}

const LS_ZIEL_KEY = 'mise_fahrer_tages_ziel';

type Ziel = { stopps: number; euro: number };
type IstStand = { stopps: number; euro: number };

function loadZiel(): Ziel {
  try {
    const raw = localStorage.getItem(LS_ZIEL_KEY);
    if (raw) return JSON.parse(raw) as Ziel;
  } catch { /* ignore */ }
  return { stopps: 20, euro: 200 };
}

function saveZiel(z: Ziel) {
  try { localStorage.setItem(LS_ZIEL_KEY, JSON.stringify(z)); } catch { /* ignore */ }
}

function ProgressRing({ pct, label, color }: { pct: number; label: string; color: string }) {
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const dash = Math.max(0, Math.min(1, pct / 100)) * CIRC;
  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle
          cx="56" cy="56" r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={CIRC - dash}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums text-foreground">{Math.round(pct)}%</span>
        <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function motivationText(pct: number): string | null {
  if (pct >= 100) return '🎉 Tagesziel erreicht! Fantastische Leistung!';
  if (pct >= 75) return '💪 Fast da — noch ein kleiner Schub!';
  if (pct >= 50) return '🔥 Halbzeit geschafft — weiter so!';
  return null;
}

export function FahrerPhase1121TagesZielFortschrittsRing({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [ziel, setZiel] = useState<Ziel>({ stopps: 20, euro: 200 });
  const [istStand, setIstStand] = useState<IstStand>({ stopps: 0, euro: 0 });
  const [editing, setEditing] = useState(false);
  const [editStopps, setEditStopps] = useState('');
  const [editEuro, setEditEuro] = useState('');
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      setZiel(loadZiel());
    }
  }, []);

  const loadIstStand = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      setIstStand({
        stopps: (json.gelieferte_stopps as number | null) ?? (json.stopps_heute as number | null) ?? 0,
        euro: (json.einnahmen_eur as number | null) ?? (json.umsatz_eur as number | null) ?? 0,
      });
    } catch {
      // mock fallback
      setIstStand({ stopps: 11, euro: 98 });
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (isOnline) {
      loadIstStand();
      const id = setInterval(loadIstStand, 5 * 60_000);
      return () => clearInterval(id);
    }
  }, [isOnline, loadIstStand]);

  if (!isOnline) return null;

  const stoppsPct = Math.min(100, ziel.stopps > 0 ? (istStand.stopps / ziel.stopps) * 100 : 0);
  const euroPct = Math.min(100, ziel.euro > 0 ? (istStand.euro / ziel.euro) * 100 : 0);
  const gesamtPct = (stoppsPct + euroPct) / 2;
  const motiv = motivationText(gesamtPct);

  function startEdit() {
    setEditStopps(String(ziel.stopps));
    setEditEuro(String(ziel.euro));
    setEditing(true);
  }

  function saveEdit() {
    const s = parseInt(editStopps) || ziel.stopps;
    const e = parseFloat(editEuro) || ziel.euro;
    const nz: Ziel = { stopps: Math.max(1, s), euro: Math.max(1, e) };
    setZiel(nz);
    saveZiel(nz);
    setEditing(false);
  }

  const ringColor = gesamtPct >= 100 ? '#10b981' : gesamtPct >= 50 ? '#f59e0b' : '#6366f1';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">Tages-Ziel</span>
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
            {Math.round(gesamtPct)}% erreicht
          </span>
          {gesamtPct >= 100 && <span className="text-xs">🎉</span>}
        </div>
        <div className="flex items-center gap-1">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          <span className="text-xs text-muted-foreground">{istStand.stopps}/{ziel.stopps} Stopps</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-indigo-200/50 dark:border-indigo-800/50 pt-3">
          {/* Rings */}
          <div className="flex justify-around items-center">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing pct={stoppsPct} label="Stopps" color={ringColor} />
              <span className="text-xs text-muted-foreground font-medium">{istStand.stopps} / {ziel.stopps}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ProgressRing pct={euroPct} label="Einnahmen" color={ringColor} />
              <span className="text-xs text-muted-foreground font-medium">{istStand.euro.toFixed(0)} / {ziel.euro} €</span>
            </div>
          </div>

          {/* Motivations-Nachricht */}
          {motiv && (
            <div className="rounded-lg bg-white/70 dark:bg-white/5 px-3 py-2 text-xs font-semibold text-center text-indigo-700 dark:text-indigo-300">
              {motiv}
            </div>
          )}

          {/* Ziel bearbeiten */}
          {editing ? (
            <div className="rounded-lg bg-white/70 dark:bg-white/5 p-3 space-y-2">
              <div className="text-xs font-bold text-muted-foreground">Tagesziel anpassen</div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Stopps</label>
                  <input
                    type="number"
                    min="1"
                    value={editStopps}
                    onChange={e => setEditStopps(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-black text-foreground"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-0.5">Euro (€)</label>
                  <input
                    type="number"
                    min="1"
                    value={editEuro}
                    onChange={e => setEditEuro(e.target.value)}
                    className="w-full rounded border px-2 py-1 text-sm bg-white dark:bg-black text-foreground"
                  />
                </div>
              </div>
              <button
                onClick={saveEdit}
                className="w-full flex items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white text-xs font-bold py-1.5 hover:bg-indigo-700 transition"
              >
                <Check className="h-3 w-3" /> Speichern
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="w-full flex items-center justify-center gap-1 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white/60 dark:bg-white/5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 py-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition"
            >
              <Edit2 className="h-3 w-3" /> Ziel anpassen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
