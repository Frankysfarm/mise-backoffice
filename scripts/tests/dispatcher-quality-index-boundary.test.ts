import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLieferQualitaetsIndex } from '../../app/(admin)/dispatch/phase1383-liefer-qualitaets-index-widget';
import { parseFahrerEffizienzMatrix } from '../../app/(admin)/dispatch/phase1392-fahrer-effizienz-matrix-widget';
import { parseSchichtProduktivitaet } from '../../app/(admin)/dispatch/phase1412-schicht-produktivitaets-cockpit';

const locationId = 'b3000000-0000-4000-8000-000000000001';
const valid = {
  index: 82,
  trend_vs_7tage: 3,
  status: 'gut',
  kpis: { puenktlichkeit_pct: 90, kundenbewertung_avg: 4.4, storno_rate_pct: 2, vollstaendigkeit_pct: 98 },
  location_id: locationId,
  generiert_am: '2026-08-03T12:00:00.000Z',
};

test('quality-index parser accepts the canonical endpoint response', () => {
  assert.deepEqual(parseLieferQualitaetsIndex(valid, locationId), valid);
});

test('quality-index parser fails closed for malformed and mismatched responses', () => {
  assert.equal(parseLieferQualitaetsIndex([], locationId), null);
  assert.equal(parseLieferQualitaetsIndex({ ...valid, kpis: undefined }, locationId), null);
  assert.equal(parseLieferQualitaetsIndex({ ...valid, index: Number.NaN }, locationId), null);
  assert.equal(parseLieferQualitaetsIndex({ ...valid, location_id: 'another-tenant-location' }, locationId), null);
  assert.equal(parseLieferQualitaetsIndex({ ...valid, generiert_am: 'invalid' }, locationId), null);
});

test('driver-efficiency matrix parser accepts canonical data and rejects generic arrays', () => {
  const response = {
    fahrer: [{ id: 'driver-1', name: 'Test Fahrer' }],
    zellen: [{ fahrer_id: 'driver-1', wochentag: 1, wochentag_label: 'Mo', km_pro_stopp: 1.2, puenktlichkeit_pct: 95, trinkgeld_avg: null, anzahl_touren: 3 }],
    wochentage: [{ index: 1, label: 'Mo' }],
    location_id: locationId,
    generiert_am: '2026-08-03T12:00:00.000Z',
  };
  assert.deepEqual(parseFahrerEffizienzMatrix(response, locationId), response);
  assert.equal(parseFahrerEffizienzMatrix([], locationId), null);
  assert.equal(parseFahrerEffizienzMatrix({ ...response, zellen: undefined }, locationId), null);
  assert.equal(parseFahrerEffizienzMatrix({ ...response, location_id: 'wrong-location' }, locationId), null);
});

test('shift-productivity parser fails closed when driver rows are absent', () => {
  const response = {
    fahrer: [{ driver_id: 'driver-1', name: 'Test Fahrer', bestellungen_heute: 4, stunden_aktiv: 2, bestellungen_pro_stunde: 2, ranking: 'mitte' }],
    schnitt_bestellungen_pro_stunde: 2,
  };
  assert.deepEqual(parseSchichtProduktivitaet(response), response);
  assert.equal(parseSchichtProduktivitaet([]), null);
  assert.equal(parseSchichtProduktivitaet({ schnitt_bestellungen_pro_stunde: 2 }), null);
  assert.equal(parseSchichtProduktivitaet({ ...response, fahrer: [{ ...response.fahrer[0], ranking: 'invented' }] }), null);
});
