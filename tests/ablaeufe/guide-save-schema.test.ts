import { describe, expect, it } from 'vitest';
import { guideSaveSchema, invalidGuideMediaPaths } from '@/lib/ablaeufe/guide-save-schema';

const base = {
  title: 'Filialleiter-Tagescheck',
  type: 'control',
  active: true,
  content: { schemaVersion: 1, categories: [{ id: 'c1', title: 'Check', steps: [] }] },
};

describe('Listen-Kopplung (Speichern-Schema)', () => {
  it('Standard bleibt die Schicht-Kopplung ohne Zusatzfelder', () => {
    const parsed = guideSaveSchema.parse(base);
    expect(parsed.assignmentKind).toBe('schicht');
    expect(parsed.assigneeIds).toEqual([]);
  });
  it('Rollen-Kopplung verlangt eine gültige Rolle', () => {
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'rolle' }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'rolle', assignedRole: 'chef' }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'rolle', assignedRole: 'manager' }).success).toBe(true);
  });
  it('Mitarbeiter-Kopplung verlangt mindestens eine gültige Mitarbeiter-ID', () => {
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'mitarbeiter' }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'mitarbeiter', assigneeIds: ['nix'] }).success).toBe(false);
    expect(guideSaveSchema.safeParse({
      ...base,
      assignmentKind: 'mitarbeiter',
      assigneeIds: ['11111111-2222-4333-8444-555555555555'],
    }).success).toBe(true);
  });
});

describe('Medienpfad-Absicherung beim Speichern', () => {
  const content = (path: string) => ({
    schemaVersion: 1 as const,
    categories: [{ id: 'c1', title: 'A', steps: [{ id: 's1', title: 'S', description: '', required: false, evidence: 'none' as const, confirmationText: '', unit: '', assigneeHint: '', media: [{ kind: 'image' as const, path, caption: '' }] }] }],
  });
  it('erlaubt nur Betriebs-eigene Listen-Ordner', () => {
    expect(invalidGuideMediaPaths('tenant-1', content('tenant-1/guides/11111111-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg'))).toEqual([]);
    expect(invalidGuideMediaPaths('tenant-1', content('tenant-2/guides/11111111-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg'))).toHaveLength(1);
    expect(invalidGuideMediaPaths('tenant-1', content('tenant-1/operations/geheim/nachweis.jpg'))).toHaveLength(1);
    expect(invalidGuideMediaPaths('tenant-1', content('tenant-1/guides/../../x.jpg'))).toHaveLength(1);
  });
});

describe('Bereichs-Zuweisung und Zeitplan (Speichern-Schema)', () => {
  it('Bereichs-Kopplung verlangt einen Bereich', () => {
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'bereich' }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, assignmentKind: 'bereich', assignedDepartmentId: '11111111-2222-4333-8444-555555555555' }).success).toBe(true);
  });
  it('Wochentage werden dedupliziert, sortiert und „alle Tage“ wird zu täglich (null)', () => {
    const parsed = guideSaveSchema.parse({ ...base, scheduleWeekdays: [5, 1, 5, 3] });
    expect(parsed.scheduleWeekdays).toEqual([1, 3, 5]);
    expect(guideSaveSchema.parse({ ...base, scheduleWeekdays: [1, 2, 3, 4, 5, 6, 7] }).scheduleWeekdays).toBeNull();
    expect(guideSaveSchema.parse({ ...base }).scheduleWeekdays).toBeNull();
    expect(guideSaveSchema.safeParse({ ...base, scheduleWeekdays: [0] }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, scheduleWeekdays: [8] }).success).toBe(false);
  });
  it('Uhrzeit nur im Format HH:MM', () => {
    expect(guideSaveSchema.safeParse({ ...base, dueTime: '11:30' }).success).toBe(true);
    expect(guideSaveSchema.safeParse({ ...base, dueTime: '24:00' }).success).toBe(false);
    expect(guideSaveSchema.safeParse({ ...base, dueTime: 'mittags' }).success).toBe(false);
  });
});
