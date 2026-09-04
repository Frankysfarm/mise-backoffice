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

describe('Anleitungs-Medien pro Schritt (Listen-Builder)', () => {
  it('akzeptiert Bild- und Video-Medien mit Storage-Pfad und Beschriftung', () => {
    const normalized = normalizeProcedureContent({
      categories: [{
        name: 'Öffnung',
        steps: [{
          title: 'Maschine entkalken',
          media: [
            { kind: 'image', path: 't1/guides/g1/a.jpg', caption: 'Ventil' },
            { kind: 'video', path: 't1/guides/g1/b.mp4' },
          ],
        }],
      }],
    });
    expect(normalized.categories[0].steps[0].media).toEqual([
      { kind: 'image', path: 't1/guides/g1/a.jpg', caption: 'Ventil' },
      { kind: 'video', path: 't1/guides/g1/b.mp4', caption: '' },
    ]);
    expect(procedureContentSchema.safeParse(normalized).success).toBe(true);
  });
  it('weist ungültige Medien zurück (fremde Art, fehlender Pfad, mehr als 5)', () => {
    const base = structuredClone(content);
    (base.categories[0].steps[0] as Record<string, unknown>).media = [{ kind: 'audio', path: 'x' }];
    expect(procedureContentSchema.safeParse(base).success).toBe(false);
    (base.categories[0].steps[0] as Record<string, unknown>).media = [{ kind: 'image', path: '' }];
    expect(procedureContentSchema.safeParse(base).success).toBe(false);
    (base.categories[0].steps[0] as Record<string, unknown>).media = Array.from({ length: 6 }, (_, i) => ({ kind: 'image', path: `p${i}.jpg` }));
    expect(procedureContentSchema.safeParse(base).success).toBe(false);
  });
  it('verwirft beim Normalisieren kaputte Medien-Einträge statt zu scheitern', () => {
    const normalized = normalizeProcedureContent({
      categories: [{ name: 'X', steps: [{ title: 'S', media: [{ kind: 'image' }, 'quatsch', { kind: 'image', path: 'ok.jpg' }] }] }],
    });
    expect(normalized.categories[0].steps[0].media).toEqual([{ kind: 'image', path: 'ok.jpg', caption: '' }]);
  });
  it('Schritte ohne media-Feld bleiben unverändert gültig (Bestandsschutz)', () => {
    expect(content.categories[0].steps[0].media).toEqual([]);
    expect(procedureContentSchema.safeParse(content).success).toBe(true);
  });
});
