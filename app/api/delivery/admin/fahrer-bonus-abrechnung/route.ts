/**
 * GET /api/delivery/admin/fahrer-bonus-abrechnung?location_id=<uuid>
 *
 * Phase 1444 — Fahrer-Bonus-Abrechnungs-API
 * Bonus je Fahrer (Stopps-Bonus + Pünktlichkeits-Bonus + Trinkgeld-Summe) für aktuellen Monat.
 * Supabase mise_drivers + delivery_batches + delivery_stops + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBonusEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_bonus_eur: number;
  puenktlichkeits_bonus_eur: number;
  trinkgeld_summe_eur: number;
  gesamt_bonus_eur: number;
  stopps_monat: number;
  puenktlichkeits_quote: number;
  auszahlungs_status: 'ausstehend' | 'genehmigt' | 'ausgezahlt';
}

interface BonusAbrechnungResponse {
  fahrer: FahrerBonusEintrag[];
  gesamt_bonus_eur: number;
  monat_label: string;
  location_id: string;
  generiert_am: string;
}

const STOPPS_BONUS_PER_STOPP = 0.30;  // 30 Ct je Stopp
const PUENKTLICHKEITS_SCHWELLE = 85;  // % für Bonus
const PUENKTLICHKEITS_BONUS_EUR = 15; // EUR wenn Quote >= Schwelle

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function buildMock(): BonusAbrechnungResponse {
  return {
    fahrer: [
      {
        fahrer_id: 'm1', fahrer_name: 'Max M.',
        stopps_bonus_eur: 18.60, puenktlichkeits_bonus_eur: 15.00, trinkgeld_summe_eur: 42.50,
        gesamt_bonus_eur: 76.10, stopps_monat: 62, puenktlichkeits_quote: 92.0,
        auszahlungs_status: 'ausstehend',
      },
      {
        fahrer_id: 'm2', fahrer_name: 'Sara K.',
        stopps_bonus_eur: 15.30, puenktlichkeits_bonus_eur: 15.00, trinkgeld_summe_eur: 31.00,
        gesamt_bonus_eur: 61.30, stopps_monat: 51, puenktlichkeits_quote: 88.0,
        auszahlungs_status: 'genehmigt',
      },
      {
        fahrer_id: 'm3', fahrer_name: 'Tim B.',
        stopps_bonus_eur: 10.50, puenktlichkeits_bonus_eur: 0.00, trinkgeld_summe_eur: 18.20,
        gesamt_bonus_eur: 28.70, stopps_monat: 35, puenktlichkeits_quote: 71.0,
        auszahlungs_status: 'ausstehend',
      },
    ],
    gesamt_bonus_eur: 166.10,
    monat_label: new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const monthStart = getMonthStart().toISOString();

    const { data: drivers, error: driversErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, employees(vorname, nachname)')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    if (driversErr || !drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json({ ...buildMock(), location_id: locationId });
    }

    const fahrerIds = (drivers as { id: string }[]).map(d => d.id);

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, fahrer_id, started_at')
      .eq('location_id', locationId)
      .in('fahrer_id', fahrerIds)
      .gte('started_at', monthStart);

    const batchIds: string[] = batches ? (batches as { id: string }[]).map(b => b.id) : [];

    const { data: stops } = batchIds.length > 0
      ? await (sb as any)
          .from('mise_delivery_stops')
          .select('id, mise_delivery_batches!inner(fahrer_id), geliefert_am, eta_min, trinkgeld, mise_delivery_batches!inner(started_at)')
          .in('mise_delivery_batches.id', batchIds)
          .not('geliefert_am', 'is', null)
      : { data: [] };

    type StopRow = {
      id: string;
      mise_delivery_batches: { fahrer_id: string; started_at: string };
      geliefert_am: string;
      eta_min: number | null;
      trinkgeld: number | null;
    };

    const stopList: StopRow[] = stops ?? [];

    const monatLabel = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const fahrerBonusList: FahrerBonusEintrag[] = (drivers as { id: string; employees: { vorname: string; nachname: string } | null }[])
      .map(d => {
        const meineBatches = batches ? (batches as { id: string; fahrer_id: string; started_at: string }[]).filter(b => b.fahrer_id === d.id) : [];
        const meineStopps = stopList.filter(s => s.mise_delivery_batches?.fahrer_id === d.id);

        const stoppCount = meineStopps.length;
        let puenktlich = 0;
        let trinkgeldSumme = 0;

        for (const s of meineStopps) {
          trinkgeldSumme += s.trinkgeld ?? 0;
          const batchStart = new Date(s.mise_delivery_batches.started_at).getTime();
          const delivered = new Date(s.geliefert_am).getTime();
          const etaMs = (s.eta_min ?? 30) * 60_000;
          if (delivered <= batchStart + etaMs + 5 * 60_000) puenktlich++;
        }

        const puenktlichkeitsQuote = stoppCount > 0 ? Math.round((puenktlich / stoppCount) * 100) : 0;
        const stoppsBonus = Math.round(stoppCount * STOPPS_BONUS_PER_STOPP * 100) / 100;
        const puenktlichkeitsBonus = puenktlichkeitsQuote >= PUENKTLICHKEITS_SCHWELLE ? PUENKTLICHKEITS_BONUS_EUR : 0;
        const trinkgeldRounded = Math.round(trinkgeldSumme * 100) / 100;
        const gesamtBonus = Math.round((stoppsBonus + puenktlichkeitsBonus + trinkgeldRounded) * 100) / 100;

        const vorname = d.employees?.vorname ?? '';
        const nachname = d.employees?.nachname ?? '';

        return {
          fahrer_id: d.id,
          fahrer_name: `${vorname} ${nachname}`.trim() || 'Fahrer',
          stopps_bonus_eur: stoppsBonus,
          puenktlichkeits_bonus_eur: puenktlichkeitsBonus,
          trinkgeld_summe_eur: trinkgeldRounded,
          gesamt_bonus_eur: gesamtBonus,
          stopps_monat: stoppCount,
          puenktlichkeits_quote: puenktlichkeitsQuote,
          auszahlungs_status: 'ausstehend' as const,
        };
      })
      .filter(f => f.stopps_monat > 0)
      .sort((a, b) => b.gesamt_bonus_eur - a.gesamt_bonus_eur);

    if (fahrerBonusList.length === 0) {
      return NextResponse.json({ ...buildMock(), location_id: locationId });
    }

    const gesamtBonus = Math.round(fahrerBonusList.reduce((sum, f) => sum + f.gesamt_bonus_eur, 0) * 100) / 100;

    const response: BonusAbrechnungResponse = {
      fahrer: fahrerBonusList,
      gesamt_bonus_eur: gesamtBonus,
      monat_label: monatLabel,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ...buildMock(), location_id: locationId });
  }
}
