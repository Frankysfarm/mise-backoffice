# Route Before Departure

Migration 286 implementiert einen Sidecar-Workflow pro Batch.

```text
assigned/at_pickup
  -> pickup_ready action
  -> route_pending (Custody committed, keine Abfahrt)
  -> persist_google_route (gleiche route_version)
  -> routed
  -> depart CAS
  -> departed / batch in_progress / driver delivering
```

Der Server plant aus der aktuellen Fahrerposition. Nur Google, eine nichtleere
Polyline, positive Distanz/Dauer und exakt die offenen Drop-off-IDs werden akzeptiert.
Fallbacks autorisieren keine Abfahrt. Jeder Schritt besitzt eigene stabile Action-ID,
Fingerprint, erwartete Workflow-/Batch-/Driver-/Route-Version und Crash-Rollback.

Bei Google-Ausfall bleibt die Ware abgeholt und der Workflow `route_pending`; ein
Retry setzt exakt dort fort. Append oder Einzelstorno invalidiert den alten Plan,
erhöht `route_version` und verlangt eine neue Google-Route.
