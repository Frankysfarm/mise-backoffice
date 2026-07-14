'use client';

import React, { useEffect, useState } from 'react';

interface NaechsteSchicht {
  shift_id: string;
  datum: string;
  von: string;
  bis: string;
  status: 'offen' | 'bestaetigt' | 'abgelehnt';
}

interface Props {
  isOnline?: boolean;
  driverId?: string;
}

const MOCK: NaechsteSchicht = {
  shift_id: 'mock-shift-1',
  datum: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  von: '10:00',
  bis: '18:00',
  status: 'offen',
};

export function FahrerPhase1545SchichtAnmeldeWidget({ isOnline = false, driverId = '' }: Props) {
  const [schicht, setSchicht] = useState<NaechsteSchicht | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    // Load next pending shift from the availability API
    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/fahrer-verfuegbarkeit');
        if (!res.ok) { setSchicht(MOCK); return; }
        const json = await res.json();
        const fahrerData = (json.fahrer ?? []).find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        const naechste = fahrerData?.schichten?.[0];
        if (naechste) {
          setSchicht({ shift_id: `${naechste.datum}-${naechste.von}`, datum: naechste.datum, von: naechste.von, bis: naechste.bis, status: 'offen' });
        } else {
          setSchicht(MOCK);
        }
      } catch {
        setSchicht(MOCK);
      }
    };
    load();
  }, [isOnline, driverId]);

  const handleAktion = async (aktion: 'bestaetigt' | 'abgelehnt') => {
    if (!schicht || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/delivery/driver/schicht-bestaetigung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, shift_id: schicht.shift_id, aktion }),
      });
      setSchicht(prev => prev ? { ...prev, status: aktion } : prev);
      setDone(true);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOnline || !schicht) return null;
  if (done && schicht.status !== 'offen') {
    return (
      <div className={`rounded-xl border p-4 text-center text-sm font-semibold ${
        schicht.status === 'bestaetigt'
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300'
          : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
      }`}>
        {schicht.status === 'bestaetigt' ? '✓ Schicht bestätigt!' : '✗ Schicht abgelehnt'}
      </div>
    );
  }

  if (schicht.status !== 'offen') return null;

  const datumFormatiert = new Date(schicht.datum + 'T12:00:00').toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });

  return (
    <div className="rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📋</span>
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Nächste Schicht</h3>
      </div>
      <div className="rounded-lg bg-white/70 dark:bg-black/20 px-3 py-2 space-y-1">
        <div className="text-sm font-bold">{datumFormatiert}</div>
        <div className="text-xs text-muted-foreground font-mono">{schicht.von} – {schicht.bis} Uhr</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleAktion('bestaetigt')}
          disabled={submitting}
          className="rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-2 transition-colors"
        >
          ✓ Bestätigen
        </button>
        <button
          onClick={() => handleAktion('abgelehnt')}
          disabled={submitting}
          className="rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold py-2 transition-colors"
        >
          ✗ Ablehnen
        </button>
      </div>
    </div>
  );
}
