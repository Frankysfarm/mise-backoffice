/**
 * POS-Helpers: Steuer-Berechnung, MwSt-Heuristik, Summen.
 * Die MwSt-Logik folgt deutschem Gastro-Steuerrecht:
 *   - Getränke + Außer-Haus-Speisen = 19%
 *   - Speisen vor Ort (Tisch) = 7%
 *   - Für jetzt per `allergene`-Heuristik getypt, später explizit pro Item.
 */

export function bruttoToNetto(brutto: number, satz: number): number {
  return brutto / (1 + satz / 100);
}

export function mwstBetrag(brutto: number, satz: number): number {
  return brutto - bruttoToNetto(brutto, satz);
}

export function mwstSatzFuerItem(item: { allergene?: string[] | null; tags?: string[] | null }, orderType: 'vor_ort' | 'abholung' | 'lieferung' = 'abholung'): number {
  const hasAllergene = !!(item.allergene && item.allergene.length > 0);
  const isFood = hasAllergene || !!(item.tags?.includes('food'));
  if (isFood && orderType === 'vor_ort') return 7;
  return 19;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatBon(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** Berechnet MwSt-Gesamtsummen aus einem Cart */
export function cartSummary(
  cart: { menge: number; einzelpreis_brutto: number; mwst_satz: number }[],
): {
  brutto_gesamt: number;
  netto_gesamt: number;
  mwst_7: number;
  mwst_19: number;
} {
  let brutto_gesamt = 0;
  let mwst_7 = 0;
  let mwst_19 = 0;
  for (const l of cart) {
    const lineBrutto = l.menge * l.einzelpreis_brutto;
    brutto_gesamt += lineBrutto;
    const mw = mwstBetrag(lineBrutto, l.mwst_satz);
    if (l.mwst_satz === 7) mwst_7 += mw;
    else if (l.mwst_satz === 19) mwst_19 += mw;
  }
  return {
    brutto_gesamt: round2(brutto_gesamt),
    mwst_7: round2(mwst_7),
    mwst_19: round2(mwst_19),
    netto_gesamt: round2(brutto_gesamt - mwst_7 - mwst_19),
  };
}
