import { describe, expect, it } from 'vitest';
import { assessmentTemplateSchema, scoreAssessment } from '@/lib/application-assessments/domain';

const questions = [
  { id: 'hygiene', question: 'Wann Hände waschen?', options: [{ id: 'a', label: 'Vor Arbeitsbeginn' }, { id: 'b', label: 'Nie' }], correctOptionIds: ['a'], points: 2, mustPass: true },
  { id: 'service', question: 'Wie begrüßen?', options: [{ id: 'a', label: 'Freundlich' }, { id: 'b', label: 'Gar nicht' }], correctOptionIds: ['a'], points: 1, mustPass: false },
];

describe('application assessment domain', () => {
  it('scores points and honours mandatory questions', () => {
    expect(scoreAssessment(questions, { hygiene: ['b'], service: ['a'] }, 30)).toMatchObject({ earnedPoints: 1, maxPoints: 3, scorePercent: 33.33, mustPassFailed: true, passed: false });
  });

  it('accepts an owner-operable template and rejects unknown correct answers', () => {
    expect(assessmentTemplateSchema.safeParse({ name: 'Barista', passingThreshold: 80, passAction: 'next_stage', failAction: 'manual_review', questions, active: true }).success).toBe(true);
    expect(assessmentTemplateSchema.safeParse({ name: 'Barista', passingThreshold: 80, passAction: 'next_stage', failAction: 'manual_review', questions: [{ ...questions[0], correctOptionIds: ['missing'] }], active: true }).success).toBe(false);
  });
});
