# Dispatch Optimizer Contract

Kanonische Implementierung: `lib/delivery/adaptive-dispatch-optimizer.ts`.

Der Optimizer ist rein, deterministisch und schreibfrei. Unveränderliche Inputs
sind Fahrer-/Order-Snapshot, Straßenrouten-Schätzungen, Konfiguration und expliziter
Bewertungszeitpunkt. Ein LLM darf erläutern, aber nie filtern, scoren oder zuweisen.

Vor jedem Score gelten harte Gates: aktive Schicht/online, vertrauenswürdiges GPS,
Kapazität, Radius, Netzwerk, Deadline sowie Straßenrouten-/Umweg-Feasibility.
Danach werden ETA, Umweg, normierte Last, Fairness, Batterie und Netzwerkqualität
bewertet. Bundlegrößen laufen von eins bis zur freien Kapazität. Eine globale
Set-Packing-Suche maximiert zuerst abgedeckte Orders, minimiert dann Kosten und
entscheidet Gleichstände lexikalisch stabil. Limits brechen fail-closed ab.

Fallback: globale Bundles, globale Singles, sonst Hold. Jeder Kandidat enthält
Reason Codes oder exakte Scorefaktoren. Produktion bleibt shadow-only, bis Replay-
Drift, Laufzeitbudget und Atomic-writer-Handoff separat grün sind.
