-- Migration 005: v_open_dispatch_batches View + assign_to_driver RPC
--
-- Zweck:
--  1. v_open_dispatch_batches — vereint Legacy- und Mise-Batches zu einer
--     einheitlichen Sicht für die Fahrer-App (app/fahrer/app/page.tsx)
--  2. assign_to_driver — atomische Bridge-Write-Funktion: schreibt manuell
--     zugewiesene Touren in BEIDE Systeme (delivery_batches + mise_delivery_batches),
--     damit Smart-Dispatch-Statistiken auch manuelle Dispatch-Einträge erfassen.
--  3. claim_mise_delivery_batch — Fahrer-App kann Mise-Batches annehmen.

-- ── 1. View: v_open_dispatch_batches ────────────────────────────────────────
-- Zeigt alle offenen Batches (status='pickup' oder state='pending_acceptance')
-- als flache Zeile mit Order- und Standortdaten, die der Fahrer sehen kann.
CREATE OR REPLACE VIEW v_open_dispatch_batches AS

  -- Legacy-System (delivery_batches mit status='pickup')
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
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng
  FROM delivery_batches db
  JOIN delivery_batch_stops dbs ON dbs.batch_id = db.id
  JOIN customer_orders co       ON co.id = dbs.order_id
  LEFT JOIN locations l         ON l.id = db.location_id
  WHERE db.status = 'pickup'

UNION ALL

  -- Mise Smart-Dispatch-System (mise_delivery_batches mit state='pending_acceptance')
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
    NULL::int                     AS geschaetzte_lieferung_min,
    l.name                        AS location_name,
    l.lat                         AS location_lat,
    l.lng                         AS location_lng
  FROM mise_delivery_batches mdb
  JOIN mise_delivery_batch_stops mdbs
       ON mdbs.batch_id = mdb.id AND mdbs.type = 'dropoff'
  JOIN customer_orders co         ON co.id = mdbs.order_id
  LEFT JOIN locations l           ON l.id = co.location_id
  WHERE mdb.state = 'pending_acceptance';

COMMENT ON VIEW v_open_dispatch_batches IS
  'Fahrer-App Inbox: offene Touren aus Legacy- und Mise-System, bereit zum Annehmen. '
  'Gefiltert nach tenant_id in der Anwendung. '
  'Legacy: delivery_batches.status = ''pickup''; '
  'Mise: mise_delivery_batches.state = ''pending_acceptance''.';


-- ── 2. RPC: assign_to_driver ─────────────────────────────────────────────────
-- Atomischer Bridge-Write: manueller Dispatch schreibt in BEIDE Systeme.
-- Verwendet von app/(admin)/dispatch/client.tsx statt manueller Multi-Step-Logik.
--
-- Parameter:
--   p_employee_id  — employees.id (Supabase Auth User des Fahrers)
--   p_order_ids    — Array von customer_orders.id
--   p_location_id  — locations.id (Filiale/Restaurant)
--
-- Rückgabe: jsonb { ok, legacy_batch_id, mise_batch_id? }
CREATE OR REPLACE FUNCTION assign_to_driver(
  p_employee_id  uuid,
  p_order_ids    uuid[],
  p_location_id  uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_legacy_batch_id  uuid;
  v_mise_driver_id   uuid;
  v_mise_batch_id    uuid;
  v_auth_user_id     uuid;
  v_order_count      int := array_length(p_order_ids, 1);
  v_loc_lat          numeric(10,7);
  v_loc_lng          numeric(10,7);
  v_loc_addr         text;
  v_cust_lat         numeric(10,7);
  v_cust_lng         numeric(10,7);
  v_cust_addr        text;
  v_order_id         uuid;
  i                  int;
BEGIN
  IF v_order_count IS NULL OR v_order_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Keine Bestellungen angegeben');
  END IF;

  -- 1. Legacy Batch erstellen
  INSERT INTO delivery_batches (location_id, fahrer_id, status, startzeit, auto_erstellt)
  VALUES (p_location_id, p_employee_id, 'pickup', now(), false)
  RETURNING id INTO v_legacy_batch_id;

  -- 2. Legacy Stops
  FOR i IN 1..v_order_count LOOP
    INSERT INTO delivery_batch_stops (batch_id, order_id, reihenfolge)
    VALUES (v_legacy_batch_id, p_order_ids[i], i);
  END LOOP;

  -- 3. Customer-Orders updaten (Legacy-Felder)
  UPDATE customer_orders
  SET fahrer_id = p_employee_id,
      batch_id  = v_legacy_batch_id,
      status    = 'unterwegs'
  WHERE id = ANY(p_order_ids);

  -- 4. Driver-Status updaten
  UPDATE driver_status
  SET aktueller_batch_id = v_legacy_batch_id
  WHERE employee_id = p_employee_id;

  -- 5. Mise-Driver via employees.auth_user_id suchen
  SELECT auth_user_id INTO v_auth_user_id
  FROM employees WHERE id = p_employee_id;

  IF v_auth_user_id IS NOT NULL THEN
    SELECT id INTO v_mise_driver_id
    FROM mise_drivers WHERE auth_user_id = v_auth_user_id;
  END IF;

  -- 6. Falls Mise-Driver gefunden: auch mise_delivery_batch anlegen
  IF v_mise_driver_id IS NOT NULL THEN
    INSERT INTO mise_delivery_batches (driver_id, state, stop_count)
    VALUES (v_mise_driver_id, 'assigned', v_order_count * 2)
    RETURNING id INTO v_mise_batch_id;

    -- Location-Koordinaten einmalig laden
    SELECT lat, lng, adresse INTO v_loc_lat, v_loc_lng, v_loc_addr
    FROM locations WHERE id = p_location_id;

    -- Stops: pickup + dropoff je Bestellung
    FOR i IN 1..v_order_count LOOP
      v_order_id := p_order_ids[i];

      SELECT kunde_lat, kunde_lng, kunde_adresse
      INTO v_cust_lat, v_cust_lng, v_cust_addr
      FROM customer_orders WHERE id = v_order_id;

      INSERT INTO mise_delivery_batch_stops
        (batch_id, order_id, type, sequence, lat, lng, address)
      VALUES
        (v_mise_batch_id, v_order_id, 'pickup',  (i-1)*2,     v_loc_lat,  v_loc_lng,  v_loc_addr),
        (v_mise_batch_id, v_order_id, 'dropoff', (i-1)*2 + 1, v_cust_lat, v_cust_lng, v_cust_addr);
    END LOOP;

    -- Customer-Orders um Mise-Felder ergänzen
    UPDATE customer_orders
    SET mise_batch_id  = v_mise_batch_id,
        mise_driver_id = v_mise_driver_id
    WHERE id = ANY(p_order_ids);
  END IF;

  RETURN jsonb_build_object(
    'ok',              true,
    'legacy_batch_id', v_legacy_batch_id,
    'mise_batch_id',   v_mise_batch_id   -- kann NULL sein wenn kein Mise-Driver
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION assign_to_driver IS
  'Manueller Dispatch: weist Bestellungen einem Fahrer zu. '
  'Schreibt atomar in delivery_batches (Legacy) und ─ falls der Fahrer auch '
  'ein mise_driver ist ─ zusätzlich in mise_delivery_batches (Smart-Dispatch-Stats). '
  'Aufgerufen von app/(admin)/dispatch/client.tsx.';


-- ── 3. RPC: claim_mise_delivery_batch ────────────────────────────────────────
-- Fahrer (employees-System) nimmt einen Mise-Batch an.
-- Setzt state → 'assigned' und verknüpft Legacy-Batch falls vorhanden.
CREATE OR REPLACE FUNCTION claim_mise_delivery_batch(
  p_batch_id    uuid,
  p_employee_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_user_id   uuid;
  v_mise_driver_id uuid;
  v_rows_updated   int;
BEGIN
  -- Mise-Driver via employees.auth_user_id suchen
  SELECT auth_user_id INTO v_auth_user_id
  FROM employees WHERE id = p_employee_id;

  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kein Auth-User für Fahrer');
  END IF;

  SELECT id INTO v_mise_driver_id
  FROM mise_drivers WHERE auth_user_id = v_auth_user_id;

  IF v_mise_driver_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kein Mise-Fahrer-Account');
  END IF;

  -- Batch annehmen (nur wenn noch pending_acceptance)
  UPDATE mise_delivery_batches
  SET state      = 'assigned',
      driver_id  = v_mise_driver_id
  WHERE id = p_batch_id
    AND state = 'pending_acceptance';
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Batch nicht mehr verfügbar');
  END IF;

  RETURN jsonb_build_object('ok', true, 'mise_driver_id', v_mise_driver_id);
END;
$$;

COMMENT ON FUNCTION claim_mise_delivery_batch IS
  'Fahrer-App: Mitarbeiter (employees) nimmt einen Mise Smart-Dispatch-Batch an. '
  'Sucht den zugehörigen mise_driver via auth_user_id und setzt state → assigned.';
