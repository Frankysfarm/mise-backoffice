'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Check, GraduationCap, Loader2, Power, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TrainingModeSettings({
  tenantId, tenantName, active, activatedAt, trainingOrderCount,
}: {
  tenantId: string;
  tenantName: string;
  active: boolean;
  activatedAt: string | null;
  trainingOrderCount: number;
}) {
  const supabase = createClient();
  const [isActive, setIsActive] = useState(active);
  const [confirming, setConfirming] = useState<'on' | 'off' | null>(null);
  const [busy, startBusy] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function toggle(target: boolean) {
    setErr(null);
    startBusy(async () => {
      const { error } = await supabase.from('tenants').update({
        schulungsmodus_aktiv: target,
        schulungsmodus_aktiviert_am: target ? new Date().toISOString() : null,
      }).eq('id', tenantId);
      if (error) {
        setErr(error.message);
        return;
      }
      setIsActive(target);
      setConfirming(null);
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Status-Karte */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            'h-14 w-14 rounded-2xl grid place-items-center shrink-0',
            isActive ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500',
          )}>
            <GraduationCap className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl font-black">Schulungsmodus</h2>
              {isActive ? (
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  AKTIV
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">Aus</span>
              )}
            </div>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              {isActive
                ? `Schulungsmodus wurde am ${activatedAt ? new Date(activatedAt).toLocaleString('de-DE') : '?'} aktiviert. Alle Bestellungen werden als Trainings-Bons markiert und nicht in der TSE/DSFinV-K-Buchhaltung erfasst. Insgesamt ${trainingOrderCount} Trainings-Bons bisher.`
                : 'Aktiviere den Schulungsmodus um neuen Mitarbeitern die Kasse beizubringen — ohne dass echte Bons gebucht werden.'}
            </p>
          </div>
        </div>

        {err && (
          <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        )}

        <div className="mt-5">
          {!isActive ? (
            <button
              onClick={() => setConfirming('on')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-matcha-900 hover:bg-matcha-800 text-matcha-50 px-5 py-3 font-bold disabled:opacity-50"
            >
              <Power className="h-4 w-4" />
              Schulungsmodus einschalten
            </button>
          ) : (
            <button
              onClick={() => setConfirming('off')}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 font-bold disabled:opacity-50"
            >
              <Power className="h-4 w-4" />
              Schulungsmodus ausschalten
            </button>
          )}
        </div>
      </Card>

      {/* So funktioniert's */}
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> So funktioniert&apos;s
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="font-bold text-emerald-700">✓ Was läuft normal</div>
            <ul className="text-gray-700 space-y-1 list-disc list-inside">
              <li>Mitarbeiter loggt sich normal ein</li>
              <li>Bestellungen werden aufgenommen</li>
              <li>Karten-/Bar-Zahlung wird durchgespielt</li>
              <li>Bondrucker druckt (mit Trainings-Stempel)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="font-bold text-amber-700">⚠ Was anders ist</div>
            <ul className="text-gray-700 space-y-1 list-disc list-inside">
              <li>KEINE TSE-Buchung</li>
              <li>KEINE DSFinV-K-Erfassung</li>
              <li>Bon trägt &quot;TRAINING&quot;-Wasserzeichen</li>
              <li>Alle Trainings-Bons in eigener Liste filterbar</li>
              <li>SumUp-Karte wird wirklich gecharged (Karten-Reader weiß nichts vom Schulungsmodus)</li>
            </ul>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          <strong>Wichtig zur Karten-Zahlung:</strong> Im Schulungsmodus solltest du <strong>nur Bar oder „Sonstige"</strong> wählen.
          Karten-Reader (SumUp) chargen wirklich — die wissen nichts vom Schulungsmodus.
        </div>
      </Card>

      {/* Confirm Modal */}
      {confirming && (
        <div className="fixed inset-0 z-[60] bg-black/85 grid items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-12 w-12 rounded-2xl grid place-items-center shrink-0',
                confirming === 'on' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
              )}>
                {confirming === 'on' ? <GraduationCap className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
              </div>
              <h3 className="font-display text-xl font-black">
                {confirming === 'on' ? 'Schulungsmodus einschalten?' : 'Schulungsmodus ausschalten?'}
              </h3>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {confirming === 'on' ? (
                <>
                  Ab jetzt werden ALLE Bestellungen für <strong>{tenantName}</strong> als Trainings-Bons markiert.
                  Sie zählen NICHT zum echten Umsatz, zur TSE oder zum DSFinV-K-Export.
                  <br /><br />
                  Vergiss nicht den Modus wieder auszuschalten bevor echter Betrieb beginnt.
                </>
              ) : (
                <>
                  Ab dem Ausschalten gehen alle neuen Bestellungen wieder in den Live-Betrieb mit TSE und DSFinV-K.
                  Die {trainingOrderCount} bisherigen Trainings-Bons bleiben in der Datenbank gespeichert (filterbar) — sie werden NICHT nachträglich gebucht.
                </>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="flex-1 py-3 rounded-xl border border-gray-300 font-bold"
              >
                Abbrechen
              </button>
              <button
                onClick={() => toggle(confirming === 'on')}
                disabled={busy}
                className={cn(
                  'flex-1 py-3 rounded-xl font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50',
                  confirming === 'on' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-matcha-900 hover:bg-matcha-800',
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {confirming === 'on' ? 'Ja, einschalten' : 'Ja, ausschalten'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
