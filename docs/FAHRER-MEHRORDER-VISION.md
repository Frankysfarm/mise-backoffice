# Fahrer Mehr-Order-Flow — Vision (Founder Tahar, 2026-06-10)

## Status
- [x] Order kommt rein -> annehmen (auch waehrend Tour). Frank SIMPEL (offer-each, kein Hold). a91d26d.
- [x] Orders stapeln sich (mehrere pending_acceptance + aktive Tour mit mehreren Stops).
- [ ] Schwebende Box: angenommene-aber-nicht-gepickte Orders zeigen mit Status "wird vorbereitet".
- [ ] Kuechen-JIT: wenn Fahrer bei LETZTER aktueller Lieferung ist -> Kueche bekommt Signal
      "fang mit der naechsten Order an" (frisch, nicht zu frueh kochen).
- [ ] Fahrer zurueck am Restaurant -> vorbereitete Orders picken -> fahren.

## Prinzip
Just-in-Time-Kueche: nicht alles auf einmal kochen. Der Koch startet die naechste Charge erst,
wenn der Fahrer fast zurueck ist (= bei seiner letzten aktuellen Lieferung). So ist das Essen
frisch, wenn der Fahrer zum Einsammeln zurueckkommt.

## Spaeter (Multi-Fahrer)
Buendeln/Smart-Routing: bei mehreren Fahrern weiss das System "Stopp zu weit vom anderen" und
verteilt sinnvoll. Ein Fahrer -> kriegt alle. (Bewusst NACH dem simplen Kern.)
