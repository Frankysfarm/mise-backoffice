'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Check, Clock, Loader2, ShoppingBag, Truck } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Initial = {
  liefergebuehr: number;
  mindestbestellwert: number;
  lieferzeit_min: number;
};

export function ConditionsForm({ tenantId, initial }: { tenantId: string; initial: Initial }) {
  const supabase = createClient();
  const [fee, setFee] = useState(initial.liefergebuehr);
  const [minOrder, setMinOrder] = useState(initial.mindestbestellwert);
  const [time, setTime] = useState(initial.lieferzeit_min);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startSaving(async () => {
      await supabase
        .from('tenants')
        .update({
          liefergebuehr: fee,
          mindestbestellwert: minOrder,
          durchschnittliche_lieferzeit_min: time,
        })
        .eq('id', tenantId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const presetFees = [0, 1.9, 2.9, 3.9, 4.9];
  const presetMins = [0, 10, 12, 15, 20, 25];
  const presetTimes = [20, 30, 45, 60];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Liefergebühr */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Liefergebühr</h3>
            <p className="text-sm text-muted-foreground">Wird beim Checkout auf den Bestellwert addiert.</p>
          </div>
          <div className="ml-auto font-display text-2xl font-bold">{euro(fee)}</div>
        </div>

        <div className="flex gap-2 flex-wrap mb-3">
          {presetFees.map((v) => (
            <Preset key={v} active={fee === v} onClick={() => setFee(v)}>
              {v === 0 ? 'Gratis' : euro(v)}
            </Preset>
          ))}
        </div>

        <Slider
          min={0} max={10} step={0.1} value={fee}
          onChange={setFee}
          format={(v) => euro(v)}
        />
      </Card>

      {/* Mindestbestellwert */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Mindestbestellwert</h3>
            <p className="text-sm text-muted-foreground">Unter diesem Betrag ist keine Lieferung möglich.</p>
          </div>
          <div className="ml-auto font-display text-2xl font-bold">{euro(minOrder)}</div>
        </div>

        <div className="flex gap-2 flex-wrap mb-3">
          {presetMins.map((v) => (
            <Preset key={v} active={minOrder === v} onClick={() => setMinOrder(v)}>
              {v === 0 ? 'Keiner' : euro(v)}
            </Preset>
          ))}
        </div>

        <Slider
          min={0} max={50} step={1} value={minOrder}
          onChange={setMinOrder}
          format={(v) => euro(v)}
        />
      </Card>

      {/* Lieferzeit */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-matcha-100 text-matcha-800 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Durchschnittliche Lieferzeit</h3>
            <p className="text-sm text-muted-foreground">Wird dem Kunden im Shop angezeigt („ca. 30 Min.").</p>
          </div>
          <div className="ml-auto font-display text-2xl font-bold">{time} <span className="text-sm text-muted-foreground">Min.</span></div>
        </div>

        <div className="flex gap-2 flex-wrap mb-3">
          {presetTimes.map((v) => (
            <Preset key={v} active={time === v} onClick={() => setTime(v)}>
              {v} Min.
            </Preset>
          ))}
        </div>

        <Slider
          min={10} max={90} step={5} value={time}
          onChange={setTime}
          format={(v) => `${v} Min.`}
        />
      </Card>

      {/* Preview */}
      <Card className="p-5 bg-matcha-50/50 border-matcha-200">
        <div className="text-xs font-bold uppercase tracking-wider text-matcha-800 mb-2">So sehen deine Kunden das</div>
        <div className="text-sm text-matcha-900">
          {minOrder > 0 ? `Ab ${euro(minOrder)} Bestellwert. ` : 'Kein Mindestbestellwert. '}
          Lieferung {fee === 0 ? 'gratis' : `für ${euro(fee)}`}. Dauert ca. {time} Min.
        </div>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-11 px-6 rounded-xl bg-matcha-900 text-matcha-50 font-bold hover:bg-matcha-800 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Speichern
        </button>
        {saved && <span className="text-sm text-matcha-700 font-semibold">Gespeichert</span>}
      </div>
    </div>
  );
}

function Preset({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm font-semibold transition border',
        active
          ? 'bg-matcha-900 text-matcha-50 border-matcha-900'
          : 'bg-card border-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function Slider({
  min, max, step, value, onChange, format,
}: {
  min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-matcha-700"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
