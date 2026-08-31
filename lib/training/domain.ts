import { z } from 'zod';

const contentBlockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1), type: z.literal('text'), title: z.string().max(300), body: z.string().max(20_000) }),
  z.object({ id: z.string().min(1), type: z.literal('image'), title: z.string().max(300), url: z.string().url() }),
  z.object({ id: z.string().min(1), type: z.literal('video'), title: z.string().max(300), url: z.string().url() }),
  z.object({ id: z.string().min(1), type: z.literal('document'), title: z.string().max(300), url: z.string().url() }),
  z.object({
    id: z.string().min(1), type: z.literal('quiz'), question: z.string().min(1).max(2000),
    options: z.array(z.object({ id: z.string().min(1), label: z.string().min(1).max(500) })).min(2).max(12),
    correctOptionIds: z.array(z.string().min(1)).min(1), points: z.number().int().min(1).max(100), mustPass: z.boolean(),
  }),
]);

export const trainingModuleSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  category: z.string().trim().max(100).default(''),
  durationMinutes: z.number().int().min(1).max(10_000).nullable().optional(),
  required: z.boolean(), active: z.boolean(), passingThreshold: z.number().int().min(0).max(100),
  deadlineDays: z.number().int().min(1).max(3650).nullable().optional(),
  recurrenceMonths: z.number().int().min(1).max(120).nullable().optional(),
  targets: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('location'), locationId: z.string().uuid() }),
    z.object({ type: z.literal('department'), departmentId: z.string().uuid() }),
    z.object({ type: z.literal('position'), positionType: z.string().trim().min(1).max(100) }),
  ])).default([]),
  blocks: z.array(contentBlockSchema).max(200).default([]),
});

export const trainingAssignmentSchema = z.object({
  moduleId: z.string().uuid(), employeeIds: z.array(z.string().uuid()).min(1).max(500),
});

export function trainingStatus(status: string, dueAt: string | null, now = new Date()) {
  if (status !== 'bestanden' && dueAt && new Date(dueAt) < now) return 'ueberfaellig';
  return status;
}
