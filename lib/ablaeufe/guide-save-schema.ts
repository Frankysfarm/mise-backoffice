import { z } from "zod";
import { procedureContentSchema } from "@/lib/ablaeufe/schema";

export const guideRoleValues = [
  "mitarbeiter",
  "teamleiter",
  "manager",
  "backoffice",
  "admin",
  "server",
  "bartender",
  "cook",
  "dishwasher",
] as const;

export const guideSaveSchema = z.object({
  action: z.enum(["save", "duplicate"]).default("save"),
  title: z
    .string()
    .trim()
    .min(2, "Bitte einen Namen mit mindestens zwei Zeichen eingeben.")
    .max(180, "Der Name ist zu lang."),
  type: z.enum([
    "opening",
    "closing",
    "cleaning",
    "control",
    "production",
    "handover",
    "hygiene_temperature",
    "other",
  ]),
  position: z.string().trim().max(100, "Die Position ist zu lang.").optional(),
  departmentId: z
    .string()
    .uuid("Der Bereich ist ungültig.")
    .nullable()
    .optional(),
  locationId: z
    .string()
    .uuid("Der Standort ist ungültig.")
    .nullable()
    .optional(),
  shiftHint: z
    .string()
    .trim()
    .max(120, "Der Schichthinweis ist zu lang.")
    .optional(),
  active: z.boolean(),
  content: procedureContentSchema,
  assignmentKind: z.enum(["schicht", "rolle", "mitarbeiter", "bereich"]).default("schicht"),
  assignedRole: z.enum(guideRoleValues).nullable().optional(),
  assignedDepartmentId: z.string().uuid("Der Bereich ist ungültig.").nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).max(100).default([]),
  scheduleWeekdays: z
    .array(z.number().int().min(1).max(7))
    .max(7)
    .nullable()
    .optional()
    .transform((value) => {
      const unique = [...new Set(value ?? [])].sort((a, b) => a - b);
      // Alle 7 Tage = täglich = kein Filter
      return unique.length === 0 || unique.length === 7 ? null : unique;
    }),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine Uhrzeit im Format HH:MM angeben.")
    .nullable()
    .optional(),
}).superRefine((value, ctx) => {
  if (value.assignmentKind === "rolle" && !value.assignedRole)
    ctx.addIssue({ code: "custom", path: ["assignedRole"], message: "Bitte eine Rolle für die Zuordnung wählen." });
  if (value.assignmentKind === "bereich" && !value.assignedDepartmentId)
    ctx.addIssue({ code: "custom", path: ["assignedDepartmentId"], message: "Bitte einen Bereich für die Zuordnung wählen." });
  if (value.assignmentKind === "mitarbeiter" && !value.assigneeIds.length)
    ctx.addIssue({ code: "custom", path: ["assigneeIds"], message: "Bitte mindestens einen Mitarbeiter zuordnen." });
});

export type GuideSaveInput = z.infer<typeof guideSaveSchema>;

/**
 * Anleitungs-Medien dürfen nur im eigenen Betriebs-Ordner liegen
 * (`<tenant>/guides/<liste>/<datei>`). Beliebige Pfade würden beim Anzeigen
 * per Service-Role signiert – das wäre ein Leck über Betriebsgrenzen hinweg.
 * Kopierte Listen dürfen auf die Ordner ihrer Vorlage im selben Betrieb zeigen.
 */
export function invalidGuideMediaPaths(
  tenantId: string,
  content: z.infer<typeof procedureContentSchema>,
): string[] {
  const allowed = new RegExp(
    `^${tenantId}/guides/[0-9a-f-]{36}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`,
    "i",
  );
  return content.categories.flatMap((category) =>
    category.steps.flatMap((step) =>
      (step.media ?? [])
        .map((item) => item.path)
        .filter((path) => !allowed.test(path)),
    ),
  );
}
