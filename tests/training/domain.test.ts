import { describe, expect, it } from 'vitest';
import { trainingModuleSchema, trainingStatus } from '@/lib/training/domain';

describe('training domain', () => {
  it('marks due incomplete assignments overdue without changing passed records', () => {
    const now = new Date('2026-08-31T12:00:00Z');
    expect(trainingStatus('offen', '2026-08-30T12:00:00Z', now)).toBe('ueberfaellig');
    expect(trainingStatus('bestanden', '2026-08-30T12:00:00Z', now)).toBe('bestanden');
  });

  it('validates visual content blocks', () => {
    const result = trainingModuleSchema.safeParse({ title: 'Hygiene', required: true, active: true, passingThreshold: 80, blocks: [{ id: '1', type: 'video', title: 'Einführung', url: 'https://example.com/video' }] });
    expect(result.success).toBe(true);
  });
});
