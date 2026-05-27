'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, KeyRound, Loader2, Lock, Shuffle } from 'lucide-react';

type Manager = {
  id: string;
  vorname: string;
  nachname: string;
  rolle: string;
  manager_pin: string | null;
};

export function ManagerPinSettings({ managers: initial }: { managers: Manager[] }) {
  const supabase = createClient();
  const [managers, setManagers] = useState(initial);

  async function setPin(id: string, pin: string) {
    const { data, error } = await supabase.rpc('set_manager_pin', {
      p_employee_id: id,
      p_pin: pin || null,
    });
    if (error || (data && !data.ok)) {
      alert(error?.message ?? data?.error ?? 'Fehler beim Speichern');
      return;
    }
    setManagers((xs) => xs.map((m) => m.id === id ? { ...m, manager_pin: pin ? 'SET' : null } : m));
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-blue-900 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <strong>4-stellige numerische PINs.</strong> Nie gleich wie Stamm-Passwort setzen.
            Die PIN wird an der Kasse verlangt, wenn ein Mitarbeiter einen Storno &gt; 20 € oder andere freigabepflichtige Aktion durchführt.
          </div>
        </div>
      </Card>

      {managers.map((m) => (
        <ManagerRow key={m.id} manager={m} onSave={(pin) => setPin(m.id, pin)} />
      ))}

      {managers.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          Keine Manager gefunden. <a href="/employees" className="underline">Team verwalten →</a>
        </Card>
      )}
    </div>
  );
}

function ManagerRow({ manager, onSave }: { manager: Manager; onSave: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasPin = Boolean(manager.manager_pin);

  async function save() {
    if (pin.length !== 4) return;
    setSaving(true);
    await onSave(pin);
    setSaving(false);
    setSaved(true);
    setPin('');
    setTimeout(() => setSaved(false), 2000);
  }

  function random() {
    const p = Math.floor(1000 + Math.random() * 9000).toString();
    setPin(p);
  }

  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-11 w-11 rounded-xl grid place-items-center font-display font-bold shrink-0 ${
        hasPin ? 'bg-matcha-700 text-white' : 'bg-gray-200 text-gray-500'
      }`}>
        {hasPin ? <Check className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{manager.vorname} {manager.nachname}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {manager.rolle} · {hasPin ? 'PIN gesetzt' : 'Kein PIN'}
        </div>
      </div>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        maxLength={4}
        placeholder="0000"
        type="password"
        className="h-11 w-24 rounded-xl border-2 bg-white text-center font-display text-xl font-black tracking-[0.4em]"
      />
      <button onClick={random} className="h-11 w-11 rounded-xl border bg-white hover:bg-muted grid place-items-center" title="Zufall">
        <Shuffle className="h-4 w-4" />
      </button>
      <button
        onClick={save}
        disabled={pin.length !== 4 || saving}
        className="h-11 px-4 rounded-xl bg-matcha-900 text-matcha-50 font-bold text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saved ? '✓' : 'Setzen'}
      </button>
    </Card>
  );
}
