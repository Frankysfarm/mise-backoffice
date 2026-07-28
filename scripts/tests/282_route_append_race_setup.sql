\set ON_ERROR_STOP on

CREATE TABLE t08_race_barriers(name text PRIMARY KEY,released boolean NOT NULL DEFAULT false);
CREATE FUNCTION fn_t08_race_barrier(p_name text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE done boolean; attempt integer; key integer:=hashtext(p_name);
BEGIN
  PERFORM pg_advisory_lock_shared(28290,key);
  FOR attempt IN 1..1000 LOOP
    SELECT released INTO done FROM t08_race_barriers WHERE name=p_name;
    IF coalesce(done,false) THEN
      PERFORM pg_advisory_unlock_shared(28290,key); RETURN;
    END IF;
    PERFORM pg_sleep(.01);
  END LOOP;
  PERFORM pg_advisory_unlock_shared(28290,key);
  RAISE EXCEPTION 'T08_BARRIER_TIMEOUT';
END $$;

INSERT INTO tenants(id,name,slug) VALUES
('83000000-0000-0000-0000-000000000001','T08 Race','t08-race');
INSERT INTO locations(id,tenant_id,name) VALUES
('83000000-0000-0000-0000-000000000002',
 '83000000-0000-0000-0000-000000000001','Race Store');
INSERT INTO mise_drivers(id,name,active,state,current_capacity,max_capacity,state_version)
VALUES('83000000-0000-0000-0000-000000000020','Race Driver',true,'assigned',1,4,0);
INSERT INTO mise_driver_tenants VALUES
('83000000-0000-0000-0000-000000000020',
 '83000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,route_version,state_version,
 pickup_deadline_at,delivery_deadline_at)
VALUES('83000000-0000-0000-0000-000000000030',
 '83000000-0000-0000-0000-000000000020','assigned',
 '83000000-0000-0000-0000-000000000002',1,1,now()+interval '20 min',now()+interval '60 min');
INSERT INTO customer_orders(id,tenant_id,location_id,bestellnummer,kunde_name,typ,status,
 mise_batch_id,mise_driver_id) VALUES
('83000000-0000-0000-0000-000000000011','83000000-0000-0000-0000-000000000001',
 '83000000-0000-0000-0000-000000000002','base','fixture','lieferung','assigned',
 '83000000-0000-0000-0000-000000000030','83000000-0000-0000-0000-000000000020'),
('83000000-0000-0000-0000-000000000012','83000000-0000-0000-0000-000000000001',
 '83000000-0000-0000-0000-000000000002','a','fixture','lieferung','fertig',NULL,NULL),
('83000000-0000-0000-0000-000000000013','83000000-0000-0000-0000-000000000001',
 '83000000-0000-0000-0000-000000000002','b','fixture','lieferung','fertig',NULL,NULL);
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,lat,lng,address,state)
VALUES
('83000000-0000-0000-0000-000000000031','83000000-0000-0000-0000-000000000030',
 '83000000-0000-0000-0000-000000000011','pickup',0,50,6,'store','pending'),
('83000000-0000-0000-0000-000000000032','83000000-0000-0000-0000-000000000030',
 '83000000-0000-0000-0000-000000000011','dropoff',1,50.01,6.01,'base','pending');
INSERT INTO dispatch_routing_hold_config_v2(tenant_id,enabled,shadow_only)
VALUES('83000000-0000-0000-0000-000000000001',true,false);
SELECT fn_dispatch_set_writer_v2('83000000-0000-0000-0000-000000000001','atomic_v2',true);
SELECT fn_dispatch_claim_writer_v2('83000000-0000-0000-0000-000000000001',
 '83000000-0000-0000-0000-000000000040',120);
