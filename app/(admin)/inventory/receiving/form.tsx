'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toastError, toastSuccess } from '@/components/ui/toaster';
import { Truck, Check, X, AlertTriangle } from 'lucide-react';

type Order = { id: string; lieferant: string | null; supplier_id: string | null; gesamtbetrag: number | null; positionen: any; bestellt_am: string | null };

export function ReceivingForm({ pendingOrders, suppliers }: {
  pendingOrders: Order[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [orderId, setOrderId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [tempOk, setTempOk] = useState<boolean | null>(null);
  const [mhdOk, setMhdOk] = useState<boolean | null>(null);
  const [mengeOk, setMengeOk] = useState<boolean | null>(null);
  const [notiz, setNotiz] = useState('');

  const selectedOrder = pendingOrders.find(o => o.id === orderId);
  const positions = selectedOrder ? (Array.isArray(selectedOrder.positionen) ? selectedOrder.positionen : []) : [];

  async function submit() {
    start(async () => {
      const { error } = await createClient().from('inventory_receiving').insert({
        order_list_id: orderId || null,
        supplier_id: supplierId || selectedOrder?.supplier_id || null,
        temperatur_ok: tempOk,
        mhd_ok: mhdOk,
        menge_ok: mengeOk,
        notiz: notiz || null,
        positionen: positions,
      } as any);
      if (error) return toastError('Speichern fehlgeschlagen', error.message);

      // Order-Status auf geliefert
      if (orderId) {
        await createClient().from('order_lists').update({
          status: 'geliefert', geliefert_am: new Date().toISOString(),
        }).eq('id', orderId);
      }

      toastSuccess('Wareneingang erfasst');
      setOrderId(''); setNotiz(''); setTempOk(null); setMhdOk(null); setMengeOk(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Lieferung entgegennehmen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Offene Bestellung (optional)</Label>
            <select value={orderId} onChange={e => { setOrderId(e.target.value); const o = pendingOrders.find(x => x.id === e.target.value); if (o?.supplier_id) setSupplierId(o.supplier_id); }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— ohne Bestellung —</option>
              {pendingOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.lieferant ?? 'Unbekannt'} — bestellt {o.bestellt_am ? new Date(o.bestellt_am).toLocaleDateString('de-DE') : '?'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Lieferant</Label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">— wählen —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Positionen zeigen wenn Bestellung gewählt — mit Fach-Info */}
        {positions.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Bestellt ({positions.length} Positionen) — prüfe wo jedes Produkt hingehört:
            </div>
            <div className="space-y-1 text-sm">
              {positions.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between rounded border bg-card px-3 py-2">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.artikelnummer && <span className="text-xs text-muted-foreground ml-2">({p.artikelnummer})</span>}
                  </div>
                  <Badge variant="muted">{p.menge} {p.einheit ?? ''}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3-Punkt-Check */}
        <div className="grid grid-cols-3 gap-3">
          <CheckToggle label="Temperatur OK?" value={tempOk} onChange={setTempOk}
            hint="Kühlware unter 7°C? TK unter -15°C?" />
          <CheckToggle label="MHD OK?" value={mhdOk} onChange={setMhdOk}
            hint="Alle Produkte noch lang genug haltbar?" />
          <CheckToggle label="Menge OK?" value={mengeOk} onChange={setMengeOk}
            hint="Alles geliefert was bestellt war?" />
        </div>

        <div>
          <Label>Notiz (Abweichungen, Schäden, fehlende Positionen)</Label>
          <Textarea rows={3} className="font-sans" value={notiz} onChange={e => setNotiz(e.target.value)}
            placeholder="z.B. 2 Kartons Hafermilch fehlten, Temperatur bei Ankunft 8°C statt 7°C" />
        </div>

        <Button onClick={submit} disabled={pending} size="lg">
          {pending ? 'Speichere...' : 'Wareneingang bestätigen'}
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckToggle({ label, value, onChange, hint }: {
  label: string; value: boolean | null; onChange: (v: boolean) => void; hint: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(true)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition ${value === true ? 'border-matcha-600 bg-matcha-50 text-matcha-800' : 'border-border hover:bg-muted'}`}>
          <Check className="h-4 w-4" /> OK
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-semibold transition ${value === false ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border hover:bg-muted'}`}>
          <X className="h-4 w-4" /> Nein
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
