"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LIST_TEMPLATES } from "@/lib/ablaeufe/list-templates";

/** „+ Neue Liste“: Name + Vorlage wählen → Liste wird inaktiv angelegt und der Editor geöffnet. */
export function CreateListDialog({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [templateKey, setTemplateKey] = useState("oeffnung");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function create() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/ablaeufe/guides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, templateKey }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Die Liste konnte nicht angelegt werden.");
      return;
    }
    router.push(`${basePath}/${result.id}`);
  }

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> Neue Liste
      </Button>
    );
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Neue Liste anlegen"
    >
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-background p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold">Neue Liste</h2>
          <p className="text-sm text-muted-foreground">
            Mit einer Vorlage starten – alles lässt sich danach im Editor
            anpassen. Die Liste ist erst aktiv, wenn du sie freischaltest.
          </p>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>Name der Liste</span>
          <Input
            autoFocus
            maxLength={180}
            placeholder="z. B. Öffnung Barista Pontstraße"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Vorlage</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {LIST_TEMPLATES.map((template) => (
              <label
                key={template.key}
                className={`cursor-pointer rounded-xl border p-3 text-sm transition ${
                  templateKey === template.key
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/40"
                }`}
              >
                <input
                  checked={templateKey === template.key}
                  className="sr-only"
                  name="template"
                  type="radio"
                  value={template.key}
                  onChange={() => setTemplateKey(template.key)}
                />
                <span className="font-semibold">{template.label}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {template.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {message && <p className="text-sm text-destructive">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Abbrechen
          </Button>
          <Button disabled={busy || title.trim().length < 2} onClick={create}>
            {busy ? "Legt an …" : "Liste anlegen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
