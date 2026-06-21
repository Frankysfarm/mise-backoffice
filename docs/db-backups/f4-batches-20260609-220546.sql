--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: mise_delivery_batch_stops; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.mise_delivery_batch_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    order_id uuid NOT NULL,
    type text NOT NULL,
    sequence integer NOT NULL,
    lat numeric(10,7),
    lng numeric(10,7),
    address text,
    eta_min integer,
    arrived_at timestamp with time zone,
    completed_at timestamp with time zone,
    pick_verification jsonb,
    delivery_proof jsonb,
    issue_type text,
    issue_detail text,
    CONSTRAINT mise_delivery_batch_stops_type_check CHECK ((type = ANY (ARRAY['pickup'::text, 'dropoff'::text])))
);


ALTER TABLE public.mise_delivery_batch_stops OWNER TO supabase_admin;

--
-- Name: mise_delivery_batches; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.mise_delivery_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_id uuid NOT NULL,
    state text DEFAULT 'assigned'::text NOT NULL,
    total_distance_km numeric(6,2),
    total_eta_min integer,
    reason_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    picked_up_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    accepted_at timestamp with time zone,
    last_push_enqueued_at timestamp with time zone,
    polyline text,
    CONSTRAINT mise_delivery_batches_state_check CHECK ((state = ANY (ARRAY['pending_acceptance'::text, 'assigned'::text, 'at_restaurant'::text, 'picked_up'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.mise_delivery_batches OWNER TO supabase_admin;

--
-- Name: COLUMN mise_delivery_batches.polyline; Type: COMMENT; Schema: public; Owner: supabase_admin
--

COMMENT ON COLUMN public.mise_delivery_batches.polyline IS 'Phase 2: Encoded Polyline (Google Directions) für die gesamte Tour';


--
-- Data for Name: mise_delivery_batch_stops; Type: TABLE DATA; Schema: public; Owner: supabase_admin
--

COPY public.mise_delivery_batch_stops (id, batch_id, order_id, type, sequence, lat, lng, address, eta_min, arrived_at, completed_at, pick_verification, delivery_proof, issue_type, issue_detail) FROM stdin;
b0898546-392b-47ea-9e12-90bd846e79ba	ca962c3a-e1f8-4757-badc-94b41d2ba427	10105777-bd01-4533-aa99-1b14aa7c4942	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
8ee2b572-45d2-4ef3-84f6-0d5727d14798	ca962c3a-e1f8-4757-badc-94b41d2ba427	10105777-bd01-4533-aa99-1b14aa7c4942	dropoff	1	50.7700000	6.1180000	Pontstrasse 30	\N	\N	\N	\N	\N	\N	\N
0a0b065b-016a-441e-a320-d54bbc6fe530	cd0b77d7-8e0b-4dcd-a860-86a621ebf6b0	1393dc90-a526-47c1-b29a-65366646e28f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	2026-06-09 20:51:14.698798+00	\N	\N	\N	\N
d26bfc3b-222b-4618-a878-7136171c981b	b15fe885-c15c-452d-96e3-069274cfed7d	31d4886b-d02d-4c29-87e4-fdbdea122779	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
00d17a88-29b5-4d4d-9179-ffc5c21f1d4e	b15fe885-c15c-452d-96e3-069274cfed7d	31d4886b-d02d-4c29-87e4-fdbdea122779	dropoff	1	50.7698000	6.1178000	Pontstrasse 35	\N	\N	\N	\N	\N	\N	\N
57987957-855f-4858-89b5-5579e728f62e	ee9d3837-8017-41ff-9940-4940bade64fc	31d4886b-d02d-4c29-87e4-fdbdea122779	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
bedf4885-8ba0-4212-8867-003f172a5e91	ee9d3837-8017-41ff-9940-4940bade64fc	31d4886b-d02d-4c29-87e4-fdbdea122779	dropoff	1	50.7698000	6.1178000	Pontstrasse 35	\N	\N	\N	\N	\N	\N	\N
973868a7-e449-424b-81c6-b546a279ed42	6241e5a2-bf3e-4ed5-802b-62ab8e8a793c	5d75baee-b7e1-45df-aac1-1ee02c0d130f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
0c414ff8-ae4a-4c73-a7dc-86c2486e2cb3	6241e5a2-bf3e-4ed5-802b-62ab8e8a793c	5d75baee-b7e1-45df-aac1-1ee02c0d130f	dropoff	1	50.7695000	6.1175000	Pontstrasse 40	\N	\N	\N	\N	\N	\N	\N
beef3756-aeef-46ce-ba2a-0451e376a97d	89426b94-9179-4cf1-999e-09949b6caf41	5d75baee-b7e1-45df-aac1-1ee02c0d130f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
f9a9490f-872f-43a7-972b-760a8b6b96f8	89426b94-9179-4cf1-999e-09949b6caf41	5d75baee-b7e1-45df-aac1-1ee02c0d130f	dropoff	1	50.7695000	6.1175000	Pontstrasse 40	\N	\N	\N	\N	\N	\N	\N
93000b4a-4348-4e3c-ad4e-169396a3647a	04a34336-a2d9-42de-936f-8ef5f5db721f	ba54fd82-f07b-4481-a0fa-16edabb3d370	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	2026-06-09 15:13:49.39915+00	\N	\N	\N	\N
7104c6ea-809f-45cf-8380-86856c22a834	04a34336-a2d9-42de-936f-8ef5f5db721f	ba54fd82-f07b-4481-a0fa-16edabb3d370	dropoff	1	50.7690000	6.1170000	Pontstrasse 50	\N	2026-06-09 15:14:38.489+00	2026-06-09 15:14:38.489+00	\N	\N	\N	\N
aafdfa48-4181-4666-9934-3efff3c7de2a	cd0b77d7-8e0b-4dcd-a860-86a621ebf6b0	1393dc90-a526-47c1-b29a-65366646e28f	dropoff	1	50.7708000	6.1190000	Oderberger Str. 8	\N	2026-06-09 20:52:11.993+00	2026-06-09 20:52:11.993+00	\N	\N	\N	\N
fb673b79-26ac-48c1-add9-5f0a633c9afe	58a648cd-3a26-485e-8948-f24ef9cb887c	1393dc90-a526-47c1-b29a-65366646e28f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
44073cfa-5d0c-41d4-912d-50f07bbea93e	58a648cd-3a26-485e-8948-f24ef9cb887c	1393dc90-a526-47c1-b29a-65366646e28f	dropoff	1	50.7708000	6.1190000	Oderberger Str. 8	\N	\N	\N	\N	\N	\N	\N
86236539-8498-452d-bba3-b41b25dcca69	d5b48803-3d15-4cc9-b9a2-95cb8e041b21	1393dc90-a526-47c1-b29a-65366646e28f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
3c97c7a1-f870-41d0-a808-d5bc2f0370e0	d5b48803-3d15-4cc9-b9a2-95cb8e041b21	1393dc90-a526-47c1-b29a-65366646e28f	dropoff	1	50.7708000	6.1190000	Oderberger Str. 8	\N	\N	\N	\N	\N	\N	\N
d4c783e4-4f7e-4b03-9a92-b939e815ed7b	046e0709-852c-4e49-9d08-d49b0357d5c3	1393dc90-a526-47c1-b29a-65366646e28f	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
e4e4e9b5-d0a0-4e23-b1b1-8b2e092d57a9	e3eb05bb-5012-4274-ae56-b31e8e8217fa	6f950a48-1d13-42a3-91b7-bcde51170fa7	pickup	0	50.7770000	6.0830000	Adalbertstraße 1, 52062, Aachen	\N	2026-05-07 17:10:34.255+00	2026-05-07 17:10:34.995+00	{"photo_url": null, "verified_at": "2026-05-07T17:10:34.255Z", "verified_item_ids": ["499c507e-11bc-4a00-bacb-08ed646ca5f9", "3a445638-4ca4-4d85-a32f-fce6185d2d63"]}	\N	\N	\N
0dc3cdf0-c436-45e7-8f70-f500274e6423	e3eb05bb-5012-4274-ae56-b31e8e8217fa	6f950a48-1d13-42a3-91b7-bcde51170fa7	dropoff	1	50.7754000	6.0838000	Theaterstraße 7	\N	\N	2026-05-07 18:46:22.108+00	\N	{"photo_url": null, "signature": null, "delivered_at": "2026-05-07T18:46:22.108Z"}	\N	\N
e7be38ee-493b-48bf-a230-599d6a204172	046e0709-852c-4e49-9d08-d49b0357d5c3	1393dc90-a526-47c1-b29a-65366646e28f	dropoff	1	50.7708000	6.1190000	Oderberger Str. 8	\N	\N	\N	\N	\N	\N	\N
7573a2a2-c725-49b7-ad5a-59fc7b92e6b4	cd0b77d7-8e0b-4dcd-a860-86a621ebf6b0	e6af72ca-3dea-4076-b691-4df805edb811	dropoff	2	50.7705000	6.1100000	Teststrasse 1	\N	2026-06-09 20:52:16.47+00	2026-06-09 20:52:16.47+00	\N	\N	\N	\N
36df1824-64de-47d2-a6e9-7f303efd7bbc	cbdcc253-966a-443b-b55f-e2787d96883b	ccad36eb-34e0-464c-bd50-df1fb14baa9a	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
d9113793-e6e5-4cfc-ba53-0a9ee82e8907	cbdcc253-966a-443b-b55f-e2787d96883b	ccad36eb-34e0-464c-bd50-df1fb14baa9a	dropoff	1	50.7705000	6.1100000	Declinestr 1	\N	\N	\N	\N	\N	\N	\N
02620aac-5c0e-4015-bce6-faae1bc9ab2c	089954d5-7ae6-43be-ad4a-22940e32d7f3	9cb5437b-b28e-4961-8a17-f93b8acca93e	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
df53a33b-d54f-4877-a0e9-d1de19917e35	089954d5-7ae6-43be-ad4a-22940e32d7f3	9cb5437b-b28e-4961-8a17-f93b8acca93e	dropoff	1	50.7705000	6.1100000	Declinestr 1	\N	\N	\N	\N	\N	\N	\N
2cff1593-7394-4f21-9ec7-aa268877a1df	089954d5-7ae6-43be-ad4a-22940e32d7f3	9cb5437b-b28e-4961-8a17-f93b8acca93e	dropoff	2	50.7705000	6.1100000	Declinestr 1	\N	\N	\N	\N	\N	\N	\N
1de55ee5-7ee5-410b-952a-bcf9328925b3	24dae5b8-d13d-412e-9914-e105747a6697	c71b6ad6-4c18-468a-bdd2-297e95dc2aa9	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
5acf8496-f85a-4859-9f1c-c3b06901411f	24dae5b8-d13d-412e-9914-e105747a6697	c71b6ad6-4c18-468a-bdd2-297e95dc2aa9	dropoff	1	50.7710000	6.1180000	Pontstrasse 22	\N	\N	\N	\N	\N	\N	\N
fd6249ad-e65c-4859-b830-2d4025058bca	f36e23b3-0b29-4ab2-9e5c-c2bcaabf8042	e1a2d8e0-8f5c-4f33-93c7-9d845b8598e0	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	2026-06-09 22:01:23.361958+00	\N	\N	\N	\N
5e20b88f-869b-4efc-bdb5-c9c7c461e3e0	f36e23b3-0b29-4ab2-9e5c-c2bcaabf8042	e1a2d8e0-8f5c-4f33-93c7-9d845b8598e0	dropoff	1	50.7700000	6.1100000	Kastanienallee 24	\N	2026-06-09 22:02:53.718+00	2026-06-09 22:02:53.718+00	\N	\N	\N	\N
3865671a-e2d6-42b9-a942-a8a3faba066a	6708d990-189d-4a61-98cc-1915ceda7c1f	a4910f88-901a-4ed2-8930-e0164a5116ef	pickup	0	50.7720000	6.1245000	Pontstrasse 1, 52062, Aachen	\N	\N	\N	\N	\N	\N	\N
0e3ae05f-af7a-4764-b5a8-54ee0b4f525c	6708d990-189d-4a61-98cc-1915ceda7c1f	a4910f88-901a-4ed2-8930-e0164a5116ef	dropoff	1	50.7706000	6.1188000	Pontstrasse 14	\N	\N	\N	\N	\N	\N	\N
16a4ee5d-8846-432d-b4fa-99072b87762e	6708d990-189d-4a61-98cc-1915ceda7c1f	ce262c67-a4cf-4de4-bbe9-eebd1447bc76	dropoff	2	50.7708000	6.1186000	Pontstrasse 18	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mise_delivery_batches; Type: TABLE DATA; Schema: public; Owner: supabase_admin
--

COPY public.mise_delivery_batches (id, driver_id, state, total_distance_km, total_eta_min, reason_text, created_at, picked_up_at, completed_at, cancelled_at, cancellation_reason, accepted_at, last_push_enqueued_at, polyline) FROM stdin;
6708d990-189d-4a61-98cc-1915ceda7c1f	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 07:47:45.18907+00	\N	\N	2026-06-09 08:02:45.882655+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 07:58:01.929661+00	\N
d5b48803-3d15-4cc9-b9a2-95cb8e041b21	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 20:15:19.142226+00	\N	\N	2026-06-09 20:30:19.896742+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 20:25:44.12892+00	\N
ca962c3a-e1f8-4757-badc-94b41d2ba427	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 11:36:06.102348+00	\N	\N	2026-06-09 11:51:08.249686+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 11:46:19.244389+00	\N
046e0709-852c-4e49-9d08-d49b0357d5c3	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 20:30:20.130911+00	\N	\N	2026-06-09 20:45:22.670108+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 20:40:46.700811+00	\N
b15fe885-c15c-452d-96e3-069274cfed7d	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 12:00:25.383734+00	\N	\N	2026-06-09 12:15:25.694048+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 12:14:24.902185+00	\N
ee9d3837-8017-41ff-9940-4940bade64fc	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 12:15:25.778944+00	\N	\N	2026-06-09 12:30:37.729074+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 12:25:48.628166+00	\N
cd0b77d7-8e0b-4dcd-a860-86a621ebf6b0	aa00482a-9567-48df-90aa-2303dc23cc3c	completed	\N	\N	\N	2026-06-09 20:45:22.792193+00	2026-06-09 20:51:14.698798+00	2026-06-09 20:52:52.853+00	\N	\N	2026-06-09 20:50:33.265135+00	2026-06-09 20:45:38.402506+00	\N
6241e5a2-bf3e-4ed5-802b-62ab8e8a793c	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 12:39:30.624007+00	\N	\N	2026-06-09 12:54:44.358475+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 12:49:40.58188+00	\N
cbdcc253-966a-443b-b55f-e2787d96883b	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 20:53:40.070839+00	\N	\N	2026-06-09 20:56:23.416+00	CEO-Testlauf Aufraeumen	\N	2026-06-09 20:53:46.033766+00	\N
89426b94-9179-4cf1-999e-09949b6caf41	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 12:54:44.42643+00	\N	\N	2026-06-09 13:09:59.46572+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 13:05:10.490924+00	\N
e3eb05bb-5012-4274-ae56-b31e8e8217fa	aa00482a-9567-48df-90aa-2303dc23cc3c	completed	3.20	14	\N	2026-05-07 17:09:26.645563+00	2026-05-07 17:10:34.995+00	2026-05-07 18:46:22.108+00	\N	\N	2026-05-07 17:09:50.965+00	\N	_m|tHm~bd@EEGF]p@DJ~AtCx@tAHJYf@Yf@g@x@YV_A`@e@XkAjAKH]eAgAaD}AiFGUAGMFm@n@eAlAGm@@UPoAHwAA{CIqAgEnDg@b@A`@AVEv@Ov@Of@Ud@[`@_BvA_B~AHdAHp@VnAn@jCn@xBNr@p@pB|@lBh@fA^x@^n@b@`@v@`@dBl@t@TPF^@v@V\\NjAf@b@TRXTTXZx@t@lA|@bAr@`@h@\\r@Rd@V^f@Z`@F~CM@wAAW]sEIw@OoA_@eDKeAM@AQAM?IS}BOuDDkAHk@\\gBB[Mc@Mc@|@aAl@y@nAkBw@qBRc@Vu@`@cAIiBGwBiADa@B
089954d5-7ae6-43be-ad4a-22940e32d7f3	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 21:48:09.728449+00	\N	\N	\N	\N	\N	2026-06-09 21:48:25.284095+00	\N
04a34336-a2d9-42de-936f-8ef5f5db721f	aa00482a-9567-48df-90aa-2303dc23cc3c	completed	\N	\N	\N	2026-06-09 14:50:55.083837+00	2026-06-09 15:13:49.39915+00	2026-06-09 15:15:03.953+00	\N	\N	2026-06-09 14:51:54.225315+00	2026-06-09 14:50:59.049507+00	\N
f36e23b3-0b29-4ab2-9e5c-c2bcaabf8042	aa00482a-9567-48df-90aa-2303dc23cc3c	in_progress	\N	\N	\N	2026-06-09 22:00:07.185597+00	2026-06-09 22:01:23.361958+00	\N	\N	\N	2026-06-09 22:01:06.460559+00	2026-06-09 22:00:23.103347+00	\N
58a648cd-3a26-485e-8948-f24ef9cb887c	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-09 20:00:05.788163+00	\N	\N	2026-06-09 20:15:18.972515+00	auto-cancel: not accepted within 15 minutes	\N	2026-06-09 20:10:30.184481+00	\N
24dae5b8-d13d-412e-9914-e105747a6697	aa00482a-9567-48df-90aa-2303dc23cc3c	cancelled	\N	\N	\N	2026-06-08 22:58:46.175731+00	\N	\N	2026-06-08 23:15:58.804896+00	auto-cancel: not accepted within 15 minutes	\N	\N	\N
\.


--
-- Name: mise_delivery_batch_stops mise_delivery_batch_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.mise_delivery_batch_stops
    ADD CONSTRAINT mise_delivery_batch_stops_pkey PRIMARY KEY (id);


--
-- Name: mise_delivery_batches mise_delivery_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.mise_delivery_batches
    ADD CONSTRAINT mise_delivery_batches_pkey PRIMARY KEY (id);


--
-- Name: idx_mise_batches_driver_active; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_mise_batches_driver_active ON public.mise_delivery_batches USING btree (driver_id) WHERE (state <> ALL (ARRAY['completed'::text, 'cancelled'::text]));


--
-- Name: idx_mise_stops_batch_seq; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_mise_stops_batch_seq ON public.mise_delivery_batch_stops USING btree (batch_id, sequence);


--
-- Name: idx_mise_stops_order; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_mise_stops_order ON public.mise_delivery_batch_stops USING btree (order_id);


--
-- Name: mise_delivery_batches trg_mise_batches_complete; Type: TRIGGER; Schema: public; Owner: supabase_admin
--

CREATE TRIGGER trg_mise_batches_complete AFTER UPDATE ON public.mise_delivery_batches FOR EACH ROW EXECUTE FUNCTION public.fn_mise_driver_complete_batch();


--
-- Name: mise_delivery_batch_stops mise_delivery_batch_stops_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.mise_delivery_batch_stops
    ADD CONSTRAINT mise_delivery_batch_stops_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.mise_delivery_batches(id) ON DELETE CASCADE;


--
-- Name: mise_delivery_batch_stops mise_delivery_batch_stops_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.mise_delivery_batch_stops
    ADD CONSTRAINT mise_delivery_batch_stops_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.customer_orders(id) ON DELETE RESTRICT;


--
-- Name: mise_delivery_batches mise_delivery_batches_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.mise_delivery_batches
    ADD CONSTRAINT mise_delivery_batches_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.mise_drivers(id) ON DELETE CASCADE;


--
-- Name: TABLE mise_delivery_batch_stops; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.mise_delivery_batch_stops TO postgres;
GRANT ALL ON TABLE public.mise_delivery_batch_stops TO anon;
GRANT ALL ON TABLE public.mise_delivery_batch_stops TO authenticated;
GRANT ALL ON TABLE public.mise_delivery_batch_stops TO service_role;


--
-- Name: TABLE mise_delivery_batches; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.mise_delivery_batches TO postgres;
GRANT ALL ON TABLE public.mise_delivery_batches TO anon;
GRANT ALL ON TABLE public.mise_delivery_batches TO authenticated;
GRANT ALL ON TABLE public.mise_delivery_batches TO service_role;


--
-- PostgreSQL database dump complete
--

