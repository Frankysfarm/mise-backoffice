'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, Clock, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// Phase 1570 — Nächste-Schicht-Erinnerungs-Karte (Fahrer-App)
// Zeigt nächste geplante Schicht + Countdown + Bestätigungsbutton.
// isOnline-Guard; 30-Min-Polling. Nur sichtbar wenn nächste Schicht < 24h.

interface SchichtData {
  schicht_id: string;
  start_iso: string;
  ende_iso: string;
  bestaetigt: boolean;
  standort?: string | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Jetzt';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Min`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Heute';
  if (d.toDateString() === tomorrow.toDateString()) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function FahrerPhase1570NaechsteSchichtErinnerungsKarte({ isOnline, driverId }: Props) {
  const [data, setData] = useState<SchichtData | null>(null);
  const [loading, setLoading] = useState(false);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/naechste-schicht?driver_id=${driverId}`);
        if (!res.ok) throw new Error('api');
        const json: SchichtData = await res.json();
        if (!cancelled) {
          setData(json);
          setBestaetigt(json.bestaetigt);
        }
      } catch {
        // Mock: Schicht morgen früh
        if (!cancelled) {
          const start = new Date();
          start.setHours(start.getHours() + 18, 0, 0, 0);
          const ende = new Date(start.getTime() + 8 * 3600000);
          setData({
            schicht_id: 'mock-1',
            start_iso: start.toISOString(),
            ende_iso: ende.toISOString(),
            bestaetigt: false,
            standort: 'Filiale Mitte',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, tick]);

  if (!isOnline || !data) return null;

  const now = Date.now();
  const startMs = new Date(data.start_iso).getTime();
  const endMs = new Date(data.ende_iso).getTime();
  const diffMs = startMs - now;

  // Nur zeigen wenn Schicht in den nächsten 24h
  if (diffMs < 0 || diffMs > 24 * 3600000) return null;

  async function confirm() {
    if (!data || confirming) return;
    setConfirming(true);
    try {
      await fetch('/api/delivery/driver/bestaetigung-schicht', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schicht_id: data.schicht_id, driver_id: driverId }),
      });
      setBestaetigt(true);
    } catch { /* noop */ } finally {
      setConfirming(false);
    }
  }

  const schichtDauerH = Math.round((endMs - startMs) / 3600000 * 10) / 10;

  return (
    <div className={cn('rounded-xl border p-3 mb-2', bestaetigt ? 'border-emerald-200 bg-emerald-50' : 'border-sky-200 bg-sky-50')}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Calendar className={cn('h-3.5 w-3.5', bestaetigt ? 'text-emerald-600' : 'text-sky-600')} />
          <span className={cn('text-xs font-bold', bestaetigt ? 'text-emerald-800' : 'text-sky-800')}>
            Nächste Schicht — {formatDate(data.start_iso)}
          </span>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {!open && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {formatTime(data.start_iso)} – {formatTime(data.ende_iso)} · in {formatCountdown(diffMs)}
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 p-2">
              <Clock className="h-3 w-3 text-sky-500 mb-0.5" />
              <div className="text-sm font-black tabular-nums text-sky-800">
                {formatTime(data.start_iso)}
              </div>
              <div className="text-[9px] text-muted-foreground">Schichtbeginn</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2">
              <Clock className="h-3 w-3 text-violet-500 mb-0.5" />
              <div className="text-sm font-black tabular-nums text-violet-800">
                {formatCountdown(diffMs)}
              </div>
              <div className="text-[9px] text-muted-foreground">Startet in</div>
            </div>
          </div>

          <div className="rounded-lg bg-white/60 px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{formatDate(data.start_iso)}, {formatTime(data.start_iso)}–{formatTime(data.ende_iso)} ({schichtDauerH}h)
              {data.standort ? ` · ${data.standort}` : ''}
            </span>
          </div>

          {bestaetigt ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[11px] font-semibold text-emerald-700">Schicht bestätigt!</span>
            </div>
          ) : (
            <button
              onClick={confirm}
              disabled={confirming}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600 disabled:opacity-60 transition"
            >
              {confirming ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              {confirming ? 'Bestätige…' : 'Schicht bestätigen'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
