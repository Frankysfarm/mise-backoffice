\set ON_ERROR_STOP on
\ir 285_schema_preflight.sql
\ir ../../scripts/migrations/285_driver_runtime_integrity.sql
INSERT INTO mise_drivers(id,active,state,push_enabled) VALUES
 ('85000000-0000-0000-0000-000000000071',true,'available',true);
