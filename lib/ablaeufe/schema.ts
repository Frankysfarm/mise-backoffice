import { z } from "zod";

export const evidenceKindSchema = z.enum([
  "none",
  "photo",
  "confirmation",
  "value",
]);

export const procedureStepSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z
      .string()
      .trim()
      .min(1, "Bitte einen Schritttitel eingeben.")
      .max(180),
    description: z.string().trim().max(1500).optional().default(""),
    required: z.boolean().default(false),
    evidence: evidenceKindSchema.default("none"),
    confirmationText: z.string().trim().max(240).optional().default(""),
    unit: z.string().trim().max(30).optional().default(""),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    assigneeHint: z.string().trim().max(120).optional().default(""),
  })
  .passthrough()
  .superRefine((step, ctx) => {
    if (step.evidence === "value" && !step.unit)
      ctx.addIssue({
        code: "custom",
        path: ["unit"],
        message: "Bitte eine Einheit angeben.",
      });
    if (step.min !== undefined && step.max !== undefined && step.min > step.max)
      ctx.addIssue({
        code: "custom",
        path: ["max"],
        message: "Der Höchstwert muss größer als der Mindestwert sein.",
      });
  });

export const procedureCategorySchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z.string().trim().min(1).max(180),
    steps: z.array(procedureStepSchema).max(100),
  })
  .passthrough();

export const procedureContentSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    categories: z.array(procedureCategorySchema).min(1).max(30),
  })
  .passthrough();

export type ProcedureStep = z.infer<typeof procedureStepSchema>;
export type ProcedureCategory = z.infer<typeof procedureCategorySchema>;
export type ProcedureContent = z.infer<typeof procedureContentSchema>;

const slug = () =>
  globalThis.crypto?.randomUUID?.() ??
  `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function emptyStep(): ProcedureStep {
  return {
    id: slug(),
    title: "",
    description: "",
    required: false,
    evidence: "none",
    confirmationText: "",
    unit: "",
    assigneeHint: "",
  };
}

export function normalizeProcedureContent(input: unknown): ProcedureContent {
  const raw =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const categories = Array.isArray(raw.categories) ? raw.categories : [];
  const normalized = categories.map((category, categoryIndex) => {
    const record =
      category && typeof category === "object"
        ? (category as Record<string, unknown>)
        : {};
    const steps = Array.isArray(record.steps) ? record.steps : [];
    return {
      id:
        typeof record.id === "string" && record.id
          ? record.id
          : `category-${categoryIndex + 1}`,
      title: String(
        record.title ?? record.name ?? `Abschnitt ${categoryIndex + 1}`,
      ),
      steps: steps.map((step, stepIndex) => {
        const value: Record<string, unknown> =
          step && typeof step === "object"
            ? (step as Record<string, unknown>)
            : { title: step };
        const legacyEvidence = String(
          value.evidence ?? value.evidence_type ?? "none",
        );
        const evidence =
          legacyEvidence === "foto"
            ? "photo"
            : legacyEvidence === "messwert"
              ? "value"
              : legacyEvidence === "unterschrift"
                ? "confirmation"
                : legacyEvidence;
        return {
          ...value,
          id:
            typeof value.id === "string" && value.id
              ? value.id
              : `step-${categoryIndex + 1}-${stepIndex + 1}`,
          title: String(
            value.title ??
              value.text ??
              value.name ??
              `Schritt ${stepIndex + 1}`,
          ),
          description: String(value.description ?? value.hint ?? ""),
          required: Boolean(value.required ?? value.pflicht ?? true),
          evidence: ["none", "photo", "confirmation", "value"].includes(
            evidence,
          )
            ? evidence
            : "none",
          confirmationText: String(value.confirmationText ?? ""),
          unit: String(value.unit ?? ""),
          min: typeof value.min === "number" ? value.min : undefined,
          max: typeof value.max === "number" ? value.max : undefined,
          assigneeHint: String(value.assigneeHint ?? value.role ?? ""),
        };
      }),
    };
  });
  if (!normalized.length)
    normalized.push({ id: "main", title: "Arbeitsschritte", steps: [] });
  return procedureContentSchema.parse({
    schemaVersion: 1,
    categories: normalized,
  });
}

export function procedureTasks(
  content: ProcedureContent,
): Record<string, unknown>[] {
  return content.categories.flatMap((category) =>
    category.steps.map((step) => ({
      ...step,
      requiresPhoto: step.evidence === "photo",
      estMin: typeof step.estMin === "number" ? step.estMin : undefined,
    })),
  );
}

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (
    from < 0 ||
    from >= items.length ||
    to < 0 ||
    to >= items.length ||
    from === to
  )
    return [...items];
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

export function valueRangeState(
  step: Pick<ProcedureStep, "evidence" | "min" | "max">,
  value: number | null,
): "missing" | "in-range" | "out-of-range" {
  if (step.evidence !== "value" || value === null || !Number.isFinite(value))
    return "missing";
  if (
    (step.min !== undefined && value < step.min) ||
    (step.max !== undefined && value > step.max)
  )
    return "out-of-range";
  return "in-range";
}

export function canCompleteProcedure(
  steps: ProcedureStep[],
  completed: Record<string, boolean>,
  evidence: Record<string, unknown>,
): boolean {
  return steps.every(
    (step) =>
      !step.required ||
      (completed[step.id] &&
        (step.evidence === "none" || Boolean(evidence[step.id]))),
  );
}
