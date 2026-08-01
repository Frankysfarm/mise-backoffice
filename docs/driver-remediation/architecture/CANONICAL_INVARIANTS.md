# Canonical Driver Invariants

Stand: 2026-08-01. Diese Regeln gelten serverseitig; UI, Push und Realtime sind
keine Schreibautorität.

1. Pro Order existiert höchstens ein aktives Assignment. Ein abgeschlossener
   Drop-off ist terminale Liefer-Evidenz und sperrt jeden Redispatch.
2. Pro Fahrer existiert höchstens ein aktiver Batch. Ein Fahrer ohne bestätigte
   Schicht ist nicht zuweisbar und erhält keinen Assignment-Alarm.
3. Kritische Mutationen benötigen Action-ID, erwartete Versionen, Tenant-/Actor-
   Prüfung, deterministische Idempotenz und eine Transaktion.
4. Alle Pflichtartikel aller aktiven Assignments müssen als vorhanden oder
   fachlich aufgelöst bestätigt sein. Erst dann darf Pickup-Custody wechseln.
5. Pickup und Abfahrt sind getrennt: `route_pending -> routed -> departed`.
   Abfahrt verlangt einen persistierten Google-Plan derselben `route_version`;
   ein Haversine-Fallback darf niemals Departure autorisieren.
6. Nur der kleinste offene `(sequence,id)`-Stop darf erreicht werden. Der eigene
   Pickup muss vor dem Drop-off abgeschlossen sein.
7. Ein Drop-off oder Einzelstorno beendet nur sein Assignment. Batch und Fahrer
   werden erst nach dem letzten aktiven Assignment terminal.
8. Eine Order während der Fahrt ist zunächst ein ablaufendes Angebot. Ohne
   explizite Fahrerzustimmung bleibt die aktive Route unverändert.
9. Push ist Wake-up, nicht State. Vor technischem ACK wird der kanonische Snapshot
   geladen; `notification_id` und Assignment-Version werden persistent dedupliziert.
10. GPS-Current-State akzeptiert nur monotone, plausible, autorisierte Punkte.
    Fehlende oder stale Position macht automatisches Dispatch fail-closed.
11. Genau ein kanonischer UI-Pfad darf Navigation, Arrival und Completion auslösen.
12. Migrationen bleiben default-off, bis Preflight, Verhalten, Race, Failpoint,
    Replay, Rollback und Canary für den exakten Release-SHA belegt sind.
