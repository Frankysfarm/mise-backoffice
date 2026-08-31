import { describe, expect, it } from 'vitest';
import {
  canCompleteProcedure,
  normalizeProcedureContent,
  procedureContentSchema,
  procedureTasks,
  reorder,
  valueRangeState,
} from '@/lib/ablaeufe/schema';

const content = normalizeProcedureContent({ categories: [{ name: 'Öffnung', steps: [{ text: 'Licht einschalten' }, { title: 'Kühlung prüfen', evidence: 'messwert', unit: '°C', min: 2, max: 7 }] }] });

describe('visuelle Abläufe', () => {
  it('normalisiert bestehende Inhalte in dieselbe categories/steps-Struktur', () => {
    expect(procedureContentSchema.safeParse(content).success).toBe(true);
    expect(content.categories[0].steps[0]).toMatchObject({ title: 'Licht einschalten', required: true, evidence: 'none' });
  });
  it('weist unvollständige Messwert-Schritte zurück', () => {
    const invalid = structuredClone(content); invalid.categories[0].steps[1].unit = '';
    expect(procedureContentSchema.safeParse(invalid).success).toBe(false);
  });
  it('sortiert ohne Mutation und ignoriert ungültige Ziele', () => {
    const original = ['a','b','c']; expect(reorder(original, 2, 0)).toEqual(['c','a','b']); expect(original).toEqual(['a','b','c']); expect(reorder(original,0,9)).toEqual(original);
  });
  it('blockiert den Abschluss bis Pflichtschritt und Nachweis vorliegen', () => {
    const steps = content.categories[0].steps;
    expect(canCompleteProcedure(steps, { [steps[0].id]: true, [steps[1].id]: true }, {})).toBe(false);
    expect(canCompleteProcedure(steps, { [steps[0].id]: true, [steps[1].id]: true }, { [steps[1].id]: true })).toBe(true);
  });
  it('bewertet Messwerte inklusive Grenzen', () => {
    const step=content.categories[0].steps[1]; expect(valueRangeState(step,2)).toBe('in-range'); expect(valueRangeState(step,7)).toBe('in-range'); expect(valueRangeState(step,8)).toBe('out-of-range'); expect(valueRangeState(step,null)).toBe('missing');
  });
  it('erhält unbekannte Legacy-Felder und erzeugt die Check-up-Kompatibilitätsansicht', () => {
    const normalized = normalizeProcedureContent({
      categories: [{
        name: 'Kontrolle',
        steps: [{ title: 'Kühlung', requiresPhoto: true, estMin: 4, extra: 'behalten' }],
      }],
    });
    expect(normalized.categories[0].steps[0]).toMatchObject({ estMin: 4, extra: 'behalten' });
    expect(procedureTasks(normalized)[0]).toMatchObject({
      title: 'Kühlung',
      estMin: 4,
      extra: 'behalten',
      requiresPhoto: false,
    });
  });
});
