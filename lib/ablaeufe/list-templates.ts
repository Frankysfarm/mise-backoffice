import type { ProcedureContent } from "@/lib/ablaeufe/schema";

export type ListTemplate = {
  key: string;
  label: string;
  description: string;
  type:
    | "opening"
    | "closing"
    | "cleaning"
    | "control"
    | "production"
    | "handover"
    | "hygiene_temperature"
    | "other";
  content: ProcedureContent;
};

const step = (
  id: string,
  title: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  title,
  description: "",
  required: true,
  evidence: "none" as const,
  confirmationText: "",
  unit: "",
  assigneeHint: "",
  media: [],
  ...extra,
});

/**
 * Start-Vorlagen für „Neue Liste“: gegen das Leere-Seite-Problem. Jede Vorlage
 * ist bewusst kurz (3–6 Schritte) und wird im Editor an den Betrieb angepasst.
 */
export const LIST_TEMPLATES: ListTemplate[] = [
  {
    key: "leer",
    label: "Leere Liste",
    description: "Ohne Vorgaben starten und alles selbst aufbauen.",
    type: "other",
    content: {
      schemaVersion: 1,
      categories: [{ id: "main", title: "Arbeitsschritte", steps: [step("s1", "Erster Schritt")] }],
    },
  },
  {
    key: "oeffnung",
    label: "Öffnung",
    description: "Laden aufschließen bis verkaufsbereit.",
    type: "opening",
    content: {
      schemaVersion: 1,
      categories: [
        {
          id: "vorbereitung",
          title: "Vorbereitung",
          steps: [
            step("licht", "Licht, Musik und Technik einschalten"),
            step("kasse", "Kasse zählen und anmelden", { evidence: "value", unit: "€" }),
            step("kuehlung", "Kühltemperaturen prüfen", { evidence: "value", unit: "°C", min: 0, max: 7 }),
          ],
        },
        {
          id: "verkaufsbereit",
          title: "Verkaufsbereit",
          steps: [
            step("theke", "Theke bestücken und sauber wischen", { evidence: "photo" }),
            step("aussen", "Außenbereich und Eingang herrichten"),
          ],
        },
      ],
    },
  },
  {
    key: "schliessung",
    label: "Schließung",
    description: "Sauber, gesichert und bereit für morgen.",
    type: "closing",
    content: {
      schemaVersion: 1,
      categories: [
        {
          id: "abschluss",
          title: "Abschluss",
          steps: [
            step("reste", "Ware wegräumen, MHD prüfen, Reste dokumentieren"),
            step("reinigung", "Arbeitsflächen und Maschinen reinigen", { evidence: "photo" }),
            step("kassensturz", "Kassensturz machen und Z-Bericht ablegen", { evidence: "confirmation", confirmationText: "Kassensturz stimmt mit dem Z-Bericht überein." }),
            step("sichern", "Fenster, Türen, Geräte aus – Laden gesichert"),
          ],
        },
      ],
    },
  },
  {
    key: "reinigung",
    label: "Reinigungsplan",
    description: "Wiederkehrende Reinigung mit Foto-Nachweis.",
    type: "cleaning",
    content: {
      schemaVersion: 1,
      categories: [
        {
          id: "bereiche",
          title: "Bereiche",
          steps: [
            step("boeden", "Böden fegen und wischen", { evidence: "photo" }),
            step("sanitaer", "Sanitärbereich reinigen und auffüllen", { evidence: "photo" }),
            step("geraete", "Geräte und Oberflächen desinfizieren"),
            step("muell", "Müll trennen und entsorgen"),
          ],
        },
      ],
    },
  },
  {
    key: "kontrolle",
    label: "Kontrolle / Check",
    description: "Regelmäßiger Qualitäts- oder Hygiene-Check.",
    type: "control",
    content: {
      schemaVersion: 1,
      categories: [
        {
          id: "check",
          title: "Prüfpunkte",
          steps: [
            step("temp", "Kühl- und Tiefkühltemperaturen dokumentieren", { evidence: "value", unit: "°C" }),
            step("sauberkeit", "Sauberkeit Verkaufsbereich prüfen", { evidence: "photo" }),
            step("bestand", "Kritische Bestände prüfen und nachmelden"),
            step("bestaetigen", "Ergebnis bestätigen", { evidence: "confirmation", confirmationText: "Alle Prüfpunkte wurden gewissenhaft kontrolliert." }),
          ],
        },
      ],
    },
  },
];

export function listTemplate(key: string): ListTemplate | undefined {
  return LIST_TEMPLATES.find((template) => template.key === key);
}
