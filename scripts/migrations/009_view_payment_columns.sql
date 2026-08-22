-- Migration 009: v_open_dispatch_batches — zahlungsart + bezahlt ergänzen
-- Hintergrund: commit c4ae106 nutzt s.zahlungsart / s.bezahlt im Fahrer-App-OpenBatchSection
-- zur Bar-Kennzeichnung pro Stop. Die View lieferte diese Spalten bisher nicht
-- (beide wurden als undefined gelesen → isCash immer false → kein Bargeld-Indikator).

CREATE OR REPLACE VIEW v_open_dispatch_batches AS

  -- Legacy (delivery_batches, status='pickup')
  SELECT
    db.id                         AS batch_id,
    l.tenant_id                   AS tenant_id,
    db.location_id                AS location_id,
    co.id                         AS order_id,
    co.bestellnummer,
    co.kunde_name,
    co.kunde_adresse,
    co.kunde_plz,
    co.kunde_stadt,
    co.kunde_lat,
    co.kunde_lng,
    co.gesamtbetrag,
    co.zahlungsart,
    co.bezahlt,
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng,
    'legacy'::text                AS source_system
  FROM delivery_batches db
  JOIN delivery_batch_stops dbs ON dbs.batch_id = db.id
  JOIN customer_orders co       ON co.id = dbs.order_id
  LEFT JOIN locations l         ON l.id = db.location_id
  WHERE db.status = 'pickup'

UNION ALL

  -- Mise Smart-Dispatch (mise_delivery_batches, state='pending_acceptance')
  SELECT
    mdb.id                        AS batch_id,
    l.tenant_id                   AS tenant_id,
    co.location_id                AS location_id,
    co.id                         AS order_id,
    co.bestellnummer,
    co.kunde_name,
    co.kunde_adresse,
    co.kunde_plz,
    co.kunde_stadt,
    co.kunde_lat,
    co.kunde_lng,
    co.gesamtbetrag,
    co.zahlungsart,
    co.bezahlt,
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng,
    'mise'::text                  AS source_system
  FROM mise_delivery_batches mdb
  JOIN mise_delivery_batch_stops mdbs
       ON mdbs.batch_id = mdb.id AND mdbs.type = 'dropoff'
  JOIN customer_orders co         ON co.id = mdbs.order_id
  LEFT JOIN locations l           ON l.id = co.location_id
  WHERE mdb.state = 'pending_acceptance';

COMMENT ON VIEW v_open_dispatch_batches IS
  'Fahrer-App Inbox: offene Touren aus Legacy- und Mise-System. '
  'source_system = ''legacy'' → claim_delivery_batch RPC. '
  'source_system = ''mise''   → claim_mise_delivery_batch RPC. '
  'zahlungsart + bezahlt: für Bar-Kassier-Indikator pro Stop (Fahrer-App).';
