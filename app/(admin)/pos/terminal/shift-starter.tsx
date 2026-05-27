'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Banknote, Check, ChefHat, Clock, Loader2, Lock, Play } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Shift = {
  id: string;
  employee_id: string;
  start_at: string;
  status: string;
};

/**
 * Schicht-Starter: Wechselgeld eintragen → Schicht öffnen.
 * Wenn bereits eine offene Schicht existiert, überspringen.
 */
export function ShiftStarter({
  tenantId, locationId, employeeId, employeeName, registerId,
  onStarted,
  existingShift,
}: {
  tenantId: string;
  locationId: string;
  employeeId: string;
  employeeName: string;
  registerId: string | null;
  onStarted: (shift: Shift) => void;
  existingShift: Shift | null;
}) {
  const supabase = createClient();
  const [wechselgeld, setWechselgeld] = useState('100');
  const [pending, startPending] = useTransition();

  // Wenn schon offene Schicht → direkt durchlassen
  if (existingShift) {
    return (
      <ShiftActiveBanner shift={existingShift} employeeName={employeeName} onContinue={() => onStarted(existingShift)} />
    );
  }

  function startShift() {
    startPending(async () => {
      const bar = Number(wechselgeld.replace(',', '.')) || 0;
      const { data, error } = await supabase.from('pos_shifts').insert({
        tenant_id: tenantId,
        location_id: locationId,
        register_id: registerId,
        employee_id: employeeId,
        start_wechselgeld: bar,
        status: 'offen',
      }).select().single();
      if (error || !data) {
        alert(error?.message ?? 'Fehler beim Schicht-Start');
        return;
      }
      onStarted(data as any);
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-white grid place-items-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-gray-900 text-white grid place-items-center mb-3">
            <Play className="h-8 w-8" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Neue Schicht starten</div>
          <h1 className="font-display text-3xl font-black mt-1">Hi, {employeeName.split(' ')[0]} 👋</h1>
          <p className="text-gray-600 mt-2">Wieviel Wechselgeld ist gerade in der Kasse?</p>
        </div>

        <div className="rounded-3xl border-2 bg-white p-6">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Startbestand Kassenlade</label>
          <div className="mt-2 relative">
            <input
              value={wechselgeld}
              onChange={(e) => setWechselgeld(e.target.value)}
              type="text"
              inputMode="decimal"
              className="w-full h-20 rounded-2xl border-4 bg-white px-4 pr-16 font-display text-5xl font-black text-center focus:outline-none focus:border-gray-900"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">€</div>
          </div>
          <div className="mt-3 flex gap-1 justify-center">
            {[50, 100, 200, 300].map((v) => (
              <button
                key={v}
                onClick={() => setWechselgeld(String(v))}
                className="flex-1 h-9 rounded-lg border bg-gray-50 hover:bg-gray-100 text-sm font-bold"
              >
                {euro(v)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={startShift}
          disabled={pending}
          className="mt-6 w-full h-14 rounded-2xl bg-gray-900 text-white font-display font-black text-lg hover:bg-gray-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
          Schicht starten
        </button>

        <div className="mt-4 text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
          <Clock className="h-3 w-3" /> Wird automatisch nach 14h beendet, falls nicht manuell abgeschlossen.
        </div>
      </div>
    </div>
  );
}

function ShiftActiveBanner({ shift, employeeName, onContinue }: { shift: Shift; employeeName: string; onContinue: () => void }) {
  const runningMin = Math.floor((Date.now() - new Date(shift.start_at).getTime()) / 60000);
  const h = Math.floor(runningMin / 60);
  const m = runningMin % 60;

  return (
    <div className="fixed inset-0 z-50 bg-white grid place-items-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-16 w-16 rounded-3xl bg-matcha-700 text-white grid place-items-center mb-4">
          <Check className="h-8 w-8" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Aktive Schicht</div>
        <h1 className="font-display text-3xl font-black mt-1">Willkommen zurück, {employeeName.split(' ')[0]}</h1>
        <p className="text-gray-600 mt-2">
          Deine Schicht läuft seit <strong>{h}h {m}min</strong>.
        </p>
        <button
          onClick={onContinue}
          className="mt-6 w-full h-14 rounded-2xl bg-gray-900 text-white font-display font-black text-lg hover:bg-gray-800"
        >
          Weiter zur Kasse →
        </button>
      </div>
    </div>
  );
}
