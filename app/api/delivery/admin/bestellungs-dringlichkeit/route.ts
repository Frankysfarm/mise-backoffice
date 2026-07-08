/**
 * GET /api/delivery/admin/bestellungs-dringlichkeit?location_id=<uuid>
 *
 * Phase 664 — Bestellungs-Dringlichkeit-API
 * Liefert alle aktiven Bestellungen sortiert nach Dringlichkeit.
 * Score 0–100: basiert auf Wartezeit, SLA-Risiko, Status und Küchenlast.
 *
 * Response: { ok, bestellungen: DringlichkeitsBestellung[], summary, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface DringlichkeitsBestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  bestellt_vor_min: number;
  sla_restzeit_min: number;
  dringlichkeit: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  dringlichkeits_score: number;
  empfehlung: string;
}

const SLA_LIMIT_MIN = 45;

function getDringlichkeit(score: number): DringlichkeitsBestellung['dringlichkeit'] {
  if (score >= 80) return 'kritisch';
  if (score >= 55) return 'hoch';
  if (score >= 30) return 'mittel';
  return 'niedrig';
}

function getEmpfehlung(status: string, slaRestMin: number, bestelltVorMin: number): string {
  if (slaRestMin <= 0) return 'SLA überschritten — sofort priorisieren';
  if (slaRestMin <= 5) return `Nur noch ${slaRestMin} Min bis SLA — jetzt starten`;
  if (status === 'bestätigt' && bestelltVorMin >= 10) return 'Noch nicht gestartet — Küche informieren';
  if (status === 'in_zubereitung' && bestelltVorMin >= 30) return 'Läuft schon lange — bitte prüfen';
  if (status === 'fertig') return 'Fertig — Fahrer beauftragen';
  return 'In Bearbeitung';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, bestellnummer, kunde_name, status, created_at, confirmed_at, prep_started_at, customer_name')
      .eq('location_id', locationId)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true });

    if (error) throw error;

    const now = Date.now();

    const bestellungen: DringlichkeitsBestellung[] = (orders ?? []).map((o) => {
      const bestelltVorMin = Math.round((now - new Date(o.created_at as string).getTime()) / 60_000);
      const slaRestMin = SLA_LIMIT_MIN - bestelltVorMin;

      // Score-Berechnung: Zeitdruck (0–50) + Status-Faktor (0–30) + SLA-Überschreitung (0–20)
      const zeitdruckScore = Math.min(50, Math.round((bestelltVorMin / SLA_LIMIT_MIN) * 50));

      const statusScore =
        o.status === 'neu' ? 20 :
        o.status === 'bestätigt' ? 15 :
        o.status === 'in_zubereitung' ? 10 :
        5; // fertig

      const slaScore = slaRestMin <= 0 ? 20 : slaRestMin <= 10 ? 15 : slaRestMin <= 20 ? 8 : 0;

      const dringlichkeits_score = Math.min(100, zeitdruckScore + statusScore + slaScore);

      const kundeName = (o.kunde_name ?? o.customer_name ?? 'Unbekannt') as string;

      return {
        id: o.id as string,
        bestellnummer: (o.bestellnummer ?? o.id.slice(0, 8)) as string,
        kunde_name: kundeName,
        status: o.status as string,
        bestellt_vor_min: bestelltVorMin,
        sla_restzeit_min: slaRestMin,
        dringlichkeit: getDringlichkeit(dringlichkeits_score),
        dringlichkeits_score,
        empfehlung: getEmpfehlung(o.status as string, slaRestMin, bestelltVorMin),
      };
    });

    bestellungen.sort((a, b) => b.dringlichkeits_score - a.dringlichkeits_score);

    const summary = {
      kritisch: bestellungen.filter((b) => b.dringlichkeit === 'kritisch').length,
      hoch: bestellungen.filter((b) => b.dringlichkeit === 'hoch').length,
      mittel: bestellungen.filter((b) => b.dringlichkeit === 'mittel').length,
      niedrig: bestellungen.filter((b) => b.dringlichkeit === 'niedrig').length,
      gesamt: bestellungen.length,
    };

    return NextResponse.json({
      ok: true,
      bestellungen,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('bestellungs-dringlichkeit error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
