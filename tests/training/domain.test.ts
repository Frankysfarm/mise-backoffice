import { describe, expect, it } from 'vitest';
import { normalizeGeneratedTrainingBlocks, trainingModuleSchema, trainingStatus } from '@/lib/training/domain';

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

  it('normalizes legacy AI lessons to canonical text and quiz blocks', () => {
    const blocks = normalizeGeneratedTrainingBlocks([
      { type: 'info', title: 'Temperatur', body: 'Nie über 80 °C.' },
      { type: 'quiz', question: 'Welche Temperatur?', options: ['80 °C', '100 °C'], correct: 0 },
    ]);
    const result = trainingModuleSchema.safeParse({ title: 'Matcha', required: true, active: true, passingThreshold: 80, blocks });
    expect(result.success).toBe(true);
    expect(blocks[0]).toMatchObject({ type: 'text', title: 'Temperatur' });
    expect(blocks[1]).toMatchObject({ type: 'quiz', correctOptionIds: ['ai-block-2-option-1'], points: 1, mustPass: false });
  });
});
