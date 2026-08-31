import { describe, expect, it } from 'vitest';
import { assessmentTemplateSchema } from '@/lib/application-assessments/domain';

const questions = [
  { id: 'hygiene', question: 'Wann Hände waschen?', options: [{ id: 'a', label: 'Vor Arbeitsbeginn' }, { id: 'b', label: 'Nie' }], correctOptionIds: ['a'], points: 2, mustPass: true },
  { id: 'service', question: 'Wie begrüßen?', options: [{ id: 'a', label: 'Freundlich' }, { id: 'b', label: 'Gar nicht' }], correctOptionIds: ['a'], points: 1, mustPass: false },
];

describe('application assessment domain', () => {
  it('accepts an owner-operable template and rejects unknown correct answers', () => {
    expect(assessmentTemplateSchema.safeParse({ name: 'Barista', passingThreshold: 80, passAction: 'next_stage', failAction: 'manual_review', questions, active: true }).success).toBe(true);
    expect(assessmentTemplateSchema.safeParse({ name: 'Barista', passingThreshold: 80, passAction: 'next_stage', failAction: 'manual_review', questions: [{ ...questions[0], correctOptionIds: ['missing'] }], active: true }).success).toBe(false);
  });

  it('rejects duplicate correct answer IDs', () => {
    expect(assessmentTemplateSchema.safeParse({ name: 'Barista', passingThreshold: 80, passAction: 'next_stage', failAction: 'manual_review', questions: [{ ...questions[0], correctOptionIds: ['a', 'a'] }], active: true }).success).toBe(false);
  });
});
