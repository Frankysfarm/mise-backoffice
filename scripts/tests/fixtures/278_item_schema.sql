CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES customer_orders(id),
  name text NOT NULL,
  pick_confirmed_at timestamptz,
  pick_missing boolean
);
CREATE TABLE driver_status (
  employee_id uuid PRIMARY KEY,
  ist_online boolean NOT NULL DEFAULT false,
  aktueller_batch_id uuid,
  last_lat double precision,
  last_lng double precision,
  last_update timestamptz
);
GRANT SELECT,INSERT,UPDATE,DELETE ON customer_orders,mise_drivers,
  mise_delivery_batches,mise_delivery_batch_stops,dispatch_offer_assignments
  TO authenticated,anon;
GRANT SELECT,UPDATE ON order_items TO authenticated,anon;
-- Deliberately dangerous legacy grant: migration 278 must preserve reads while
-- removing every browser mutation capability.
GRANT SELECT,INSERT,UPDATE,DELETE ON driver_status TO authenticated,anon;
