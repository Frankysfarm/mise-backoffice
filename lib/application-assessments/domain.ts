import { z } from 'zod';

const optionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(500),
});

export const assessmentQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  question: z.string().trim().min(1).max(2000),
  options: z.array(optionSchema).min(2).max(12),
  correctOptionIds: z.array(z.string().trim().min(1)).min(1),
  points: z.number().int().min(1).max(100),
  mustPass: z.boolean().default(false),
}).superRefine((question, context) => {
  const ids = new Set(question.options.map((option) => option.id));
  if (ids.size !== question.options.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Antwort-IDs müssen eindeutig sein.' });
  }
  if (question.correctOptionIds.some((id) => !ids.has(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Eine richtige Antwort fehlt in den Antwortmöglichkeiten.' });
  }
});

export const assessmentTemplateSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  locationId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(3000).default(''),
  passingThreshold: z.number().int().min(0).max(100),
  passAction: z.enum(['next_stage', 'manual_review', 'reject']),
  failAction: z.enum(['next_stage', 'manual_review', 'reject']),
  passMessage: z.string().trim().max(1000).default(''),
  failMessage: z.string().trim().max(1000).default(''),
  questions: z.array(assessmentQuestionSchema).min(1).max(100),
  targets: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('department'), departmentId: z.string().uuid() }),
    z.object({ type: z.literal('position'), positionType: z.string().trim().min(1).max(100) }),
  ])).default([]),
  active: z.boolean().default(true),
});

export type AssessmentQuestion = z.infer<typeof assessmentQuestionSchema>;
