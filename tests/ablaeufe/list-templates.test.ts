import { describe, expect, it } from 'vitest';
import { LIST_TEMPLATES, listTemplate } from '@/lib/ablaeufe/list-templates';
import { procedureContentSchema } from '@/lib/ablaeufe/schema';

describe('Listen-Vorlagen', () => {
  it('jede Vorlage ist gültiger Listen-Inhalt mit mindestens einem Schritt', () => {
    for (const template of LIST_TEMPLATES) {
      const parsed = procedureContentSchema.safeParse(template.content);
      expect(parsed.success, template.key).toBe(true);
      const steps = template.content.categories.reduce((sum, category) => sum + category.steps.length, 0);
      expect(steps, template.key).toBeGreaterThan(0);
    }
  });
  it('Vorlagen sind eindeutig und per Schlüssel auffindbar', () => {
    const keys = LIST_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(listTemplate('oeffnung')?.type).toBe('opening');
    expect(listTemplate('gibtsnicht')).toBeUndefined();
  });
});
