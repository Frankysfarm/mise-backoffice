INSERT INTO mise_drivers(id,name,active,state,state_version,current_capacity,max_capacity)
VALUES('43000000-0000-0000-0000-000000000001','race',true,'delivering',0,1,1);
INSERT INTO mise_driver_tenants VALUES(
 '43000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000001','active');
INSERT INTO mise_delivery_batches(id,driver_id,state,location_id,state_version,route_version)
VALUES('44000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001',
 'in_progress','32000000-0000-0000-0000-000000000001',0,0);
INSERT INTO customer_orders(id,location_id,tenant_id,typ,status,dispatch_version,mise_batch_id,mise_driver_id)
VALUES('45000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001',
 '31000000-0000-0000-0000-000000000001','lieferung','out_for_delivery',0,
 '44000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001');
INSERT INTO mise_delivery_batch_stops(id,batch_id,order_id,type,sequence,state,stop_version)
VALUES('46000000-0000-0000-0000-000000000001','44000000-0000-0000-0000-000000000001',
 '45000000-0000-0000-0000-000000000001','dropoff',1,'pending',0);

