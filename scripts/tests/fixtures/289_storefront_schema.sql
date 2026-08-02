CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE TABLE locations(id uuid PRIMARY KEY, aktiv boolean NOT NULL DEFAULT true);
CREATE TABLE menu_items(id uuid PRIMARY KEY,location_id uuid NOT NULL REFERENCES locations(id),name text NOT NULL,preis numeric NOT NULL,verfuegbar boolean NOT NULL);
CREATE TABLE customer_orders(
 id uuid PRIMARY KEY,location_id uuid NOT NULL REFERENCES locations(id),bestellnummer text DEFAULT ('TL-'||substr(gen_random_uuid()::text,1,8)),
 typ text NOT NULL,status text NOT NULL,kunde_name text,kunde_telefon text,kunde_adresse text,zwischensumme numeric,gesamtbetrag numeric,
 zahlungsart text,bezahlt boolean,quelle text
);
CREATE TABLE order_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
 location_id uuid NOT NULL,menu_item_id uuid NOT NULL,name text NOT NULL,menge integer NOT NULL,einzelpreis numeric NOT NULL,
 gesamtpreis numeric NOT NULL,position integer NOT NULL
);
