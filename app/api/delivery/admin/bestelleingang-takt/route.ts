/**
 * GET /api/delivery/admin/bestelleingang-takt?location_id=<uuid>
 *
 * Phase 1481 — Bestelleingang-Takt-API
 * Bestellungen je 15-Min-Slot der letzten 4h + Peak-Slot + Prognose nächster Slot.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TaktSlot {
  slot_start: string;
  slot_label: string;
  anzahl: number;
  ist_peak: boolean;
}

export interface BestelleingangTaktResponse {
  slots: TaktSlot[];
  peak_slot: TaktSlot | null;
  prognose_naechster_slot: number;
  gesamt_4h: number;
  durchschnitt_pro_slot: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): BestelleingangTaktResponse {
  const now = new Date();
  const slots: TaktSlot[] = [];
  const baseAnzahl = [2, 3, 1, 4, 6, 8, 5, 7, 9, 4, 6, 3, 5, 7, 8, 6];
  for (let i = 15; i >= 0; i--) {
    const slotStart = new Date(now.getTime() - i * 15 * 60_000);
    slotStart.setSeconds(0, 0);
    const minutes = slotStart.getMinutes();
    slotStart.setMinutes(Math.floor(minutes / 15) * 15);
    const label = slotStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    slots.push({
      slot_start: slotStart.toISOString(),
      slot_label: label,
      anzahl: baseAnzahl[15 - i] ?? 3,
      ist_peak: false,
    });
  }
  const gesamt = slots.reduce((s, sl) => s + sl.anzahl, 0);
  const maxAnzahl = Math.max(...slots.map((s) => s.anzahl));
  const peakSlot = slots.find((s) => s.anzahl === maxAnzahl) ?? null;
  if (peakSlot) peakSlot.ist_peak = true;
  const avg = parseFloat((gesamt / slots.length).toFixed(1));
  const lastTwo = slots.slice(-2).reduce((s, sl) => s + sl.anzahl, 0) / 2;
  const prognose = Math.round(lastTwo * 1.05);
  return {
    slots,
    peak_slot: peakSlot,
    prognose_naechster_slot: prognose,
    gesamt_4h: gesamt,
    durchschnitt_pro_slot: avg,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

interface RawOrder {
  created_at: string;
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60_000);

    const { data: ordersRaw, error } = await (sb as any)
      .from('mise_orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', fourHoursAgo.toISOString());

    if (error || !ordersRaw) throw new Error('no data');

    const orders = ordersRaw as RawOrder[];

    const slotMap: Record<string, number> = {};
    for (const o of orders) {
      const d = new Date(o.created_at);
      d.setSeconds(0, 0);
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15);
      const key = d.toISOString();
      slotMap[key] = (slotMap[key] ?? 0) + 1;
    }

    const now = new Date();
    const slots: TaktSlot[] = [];
    for (let i = 15; i >= 0; i--) {
      const slotStart = new Date(now.getTime() - i * 15 * 60_000);
      slotStart.setSeconds(0, 0);
      slotStart.setMinutes(Math.floor(slotStart.getMinutes() / 15) * 15);
      const key = slotStart.toISOString();
      const label = slotStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      slots.push({
        slot_start: key,
        slot_label: label,
        anzahl: slotMap[key] ?? 0,
        ist_peak: false,
      });
    }

    const gesamt = slots.reduce((s, sl) => s + sl.anzahl, 0);
    const maxAnzahl = Math.max(...slots.map((s) => s.anzahl), 0);
    const peakSlot = maxAnzahl > 0 ? (slots.find((s) => s.anzahl === maxAnzahl) ?? null) : null;
    if (peakSlot) peakSlot.ist_peak = true;
    const avg = parseFloat((gesamt / Math.max(slots.length, 1)).toFixed(1));
    const lastTwo = slots.slice(-2).reduce((s, sl) => s + sl.anzahl, 0) / 2;
    const prognose = Math.round(lastTwo * 1.05);

    const response: BestelleingangTaktResponse = {
      slots,
      peak_slot: peakSlot,
      prognose_naechster_slot: prognose,
      gesamt_4h: gesamt,
      durchschnitt_pro_slot: avg,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
