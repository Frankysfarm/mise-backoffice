\set ON_ERROR_STOP on

begin;
set local statement_timeout='30s';
set local lock_timeout='5s';

do $pontstrasse$
declare
  v_tenant constant uuid:='d1522124-4b9b-4362-9d9a-882a6a8621f6';
  v_location constant uuid:='bb01ae0a-da47-48b1-b986-3a1201aacc4b';
  v_actor uuid;
  v_tamer uuid; v_melisa uuid; v_abdulrahim uuid; v_tuba uuid; v_can uuid;
  v_bjoern uuid; v_nes uuid; v_nemsa uuid; v_omayma uuid;
  v_filial uuid; v_kueche uuid; v_backen uuid; v_lager uuid; v_acai uuid; v_barista uuid;
  v_pos_company uuid; v_pos_store uuid; v_pos_kueche uuid; v_pos_backen uuid;
  v_pos_lager uuid; v_pos_acai uuid; v_pos_barista uuid;
  v_gap_count integer;
begin
  if not exists(
    select 1 from public.locations
    where id=v_location and tenant_id=v_tenant and lower(name) like '%franky%'
      and lower(coalesce(adresse,'')) like '%pont%'
  ) then raise exception 'Pontstraße location does not match expected tenant'; end if;

  select id into strict v_actor from public.employees
  where tenant_id=v_tenant and location_id=v_location
    and lower(vorname)='tahar' and lower(nachname)='galai' and rolle='admin'
  order by created_at limit 1;
  perform set_config('app.audit_employee_id',v_actor::text,true);

  -- Draft employee profiles use non-routable technical identifiers only to
  -- satisfy the legacy NOT NULL column. No Auth account or invitation is made.
  insert into public.employees(
    tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,
    organization_level,legacy_mise_os_id,notizen
  ) values(
    v_tenant,v_location,'Tamer','Dhaghan','pending+pontstrasse.tamer.dhaghan@mise.local',
    'manager','aktiv','Filialleiter',20,'manual:pontstrasse:tamer-dhaghan',
    'Profilentwurf: echte E-Mail und Einladung stehen noch aus.'
  ) on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null
  do update set vorname=excluded.vorname,nachname=excluded.nachname,location_id=excluded.location_id,
    rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,
    organization_level=excluded.organization_level,updated_at=now()
  returning id into v_tamer;

  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Melisa','Özdemir','pending+pontstrasse.melisa.oezdemir@mise.local','manager','aktiv','Stellvertretende Filialleiterin',30,'manual:pontstrasse:melisa-oezdemir','Profilentwurf: echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update
  set vorname=excluded.vorname,nachname=excluded.nachname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now()
  returning id into v_melisa;

  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Abdulrahim','','pending+pontstrasse.abdulrahim@mise.local','teamleiter','aktiv','Küchenverantwortlicher',40,'manual:pontstrasse:abdulrahim','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update
  set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now()
  returning id into v_abdulrahim;

  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Tuba','','pending+pontstrasse.tuba@mise.local','teamleiter','aktiv','Backen & Lagerverantwortung',40,'manual:pontstrasse:tuba','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update
  set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now()
  returning id into v_tuba;

  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Can','','pending+pontstrasse.can@mise.local','teamleiter','aktiv','Acai-Verantwortlicher',40,'manual:pontstrasse:can','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update
  set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now()
  returning id into v_can;

  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Björn','','pending+pontstrasse.bjoern@mise.local','mitarbeiter','aktiv','Barista',50,'manual:pontstrasse:bjoern','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now() returning id into v_bjoern;
  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Nes','','pending+pontstrasse.nes@mise.local','mitarbeiter','aktiv','Barista',50,'manual:pontstrasse:nes','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now() returning id into v_nes;
  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Nemsa','','pending+pontstrasse.nemsa@mise.local','mitarbeiter','aktiv','Barista',50,'manual:pontstrasse:nemsa','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now() returning id into v_nemsa;
  insert into public.employees(tenant_id,location_id,vorname,nachname,email,rolle,status,position_title,organization_level,legacy_mise_os_id,notizen)
  values(v_tenant,v_location,'Omayma','','pending+pontstrasse.omayma@mise.local','mitarbeiter','aktiv','Barista',50,'manual:pontstrasse:omayma','Profilentwurf: Nachname, echte E-Mail und Einladung stehen noch aus.')
  on conflict(tenant_id,legacy_mise_os_id) where legacy_mise_os_id is not null do update set vorname=excluded.vorname,location_id=excluded.location_id,rolle=excluded.rolle,status=excluded.status,position_title=excluded.position_title,organization_level=excluded.organization_level,updated_at=now() returning id into v_omayma;

  -- Reuse native Neo departments first; create only genuinely missing areas.
  select id into v_kueche from public.departments
  where tenant_id=v_tenant and location_id=v_location
    and (legacy_source_id='manual:pontstrasse:kueche-hygiene' or lower(name) in ('küche','küche & hygiene'))
  order by (legacy_source_id='manual:pontstrasse:kueche-hygiene') desc,created_at asc limit 1;
  if v_kueche is null then
    insert into public.departments(tenant_id,location_id,name,legacy_source_id) values(v_tenant,v_location,'Küche & Hygiene','manual:pontstrasse:kueche-hygiene') returning id into v_kueche;
  end if;
  update public.departments set name='Küche & Hygiene',legacy_source_id='manual:pontstrasse:kueche-hygiene',aktiv=true,prioritaet=95,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,
    pflichten='["Küchenhygiene je Schicht sicherstellen","Kühl- und Vorbereitungskontrollen prüfen","Reinigung mit Nachweis freigeben","Abweichungen sofort an Filialleitung melden"]'::jsonb where id=v_kueche;

  select id into v_barista from public.departments where tenant_id=v_tenant and location_id=v_location and (legacy_source_id='manual:pontstrasse:barista' or lower(name)='barista') order by (legacy_source_id='manual:pontstrasse:barista') desc,created_at asc limit 1;
  if v_barista is null then insert into public.departments(tenant_id,location_id,name,legacy_source_id) values(v_tenant,v_location,'Barista','manual:pontstrasse:barista') returning id into v_barista; end if;
  update public.departments set name='Barista',legacy_source_id='manual:pontstrasse:barista',aktiv=true,prioritaet=75,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,
    pflichten='["Maschine, Mühle und Arbeitsplatz je Schicht prüfen","Rezept- und Qualitätsstandards einhalten","Reinigung und Rückspülung dokumentieren","Bestands- oder Technikprobleme melden"]'::jsonb where id=v_barista;

  insert into public.departments(tenant_id,location_id,name,aktiv,prioritaet,hauptverantwortung_erforderlich,stellvertretung_erforderlich,pflichten,legacy_source_id)
  values(v_tenant,v_location,'Filialleitung',true,100,true,true,'["Tagesbesetzung und Abwesenheiten prüfen","Offene und überfällige Aufgaben kontrollieren","Nachweise freigeben oder ablehnen","Übergaben und Eskalationen dokumentieren"]','manual:pontstrasse:filialleitung')
  on conflict(tenant_id,legacy_source_id) where legacy_source_id is not null do update set name=excluded.name,aktiv=true,prioritaet=excluded.prioritaet,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,pflichten=excluded.pflichten,location_id=excluded.location_id returning id into v_filial;
  insert into public.departments(tenant_id,location_id,name,aktiv,prioritaet,hauptverantwortung_erforderlich,stellvertretung_erforderlich,pflichten,legacy_source_id)
  values(v_tenant,v_location,'Backbereich',true,85,true,true,'["Backvorbereitung und Produktionsfolge prüfen","Hygiene und Allergentrennung sicherstellen","Restbestände und Reinigung dokumentieren"]','manual:pontstrasse:backbereich')
  on conflict(tenant_id,legacy_source_id) where legacy_source_id is not null do update set name=excluded.name,aktiv=true,prioritaet=excluded.prioritaet,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,pflichten=excluded.pflichten,location_id=excluded.location_id returning id into v_backen;
  insert into public.departments(tenant_id,location_id,name,aktiv,prioritaet,hauptverantwortung_erforderlich,stellvertretung_erforderlich,pflichten,legacy_source_id)
  values(v_tenant,v_location,'Lager & Ordnung',true,80,true,true,'["Lagerplätze und Laufwege frei halten","Bestände und Nachfüllbedarf melden","MHD- und Ordnungsabweichungen dokumentieren"]','manual:pontstrasse:lager-ordnung')
  on conflict(tenant_id,legacy_source_id) where legacy_source_id is not null do update set name=excluded.name,aktiv=true,prioritaet=excluded.prioritaet,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,pflichten=excluded.pflichten,location_id=excluded.location_id returning id into v_lager;
  insert into public.departments(tenant_id,location_id,name,aktiv,prioritaet,hauptverantwortung_erforderlich,stellvertretung_erforderlich,pflichten,legacy_source_id)
  values(v_tenant,v_location,'Acai',true,82,true,true,'["Temperatur, Bestand und Sauberkeit vor Start prüfen","Produktqualität und Portionierung sicherstellen","Station reinigen und Bestand übergeben"]','manual:pontstrasse:acai')
  on conflict(tenant_id,legacy_source_id) where legacy_source_id is not null do update set name=excluded.name,aktiv=true,prioritaet=excluded.prioritaet,hauptverantwortung_erforderlich=true,stellvertretung_erforderlich=true,pflichten=excluded.pflichten,location_id=excluded.location_id returning id into v_acai;

  update public.employees set department_id=v_filial,reports_to_employee_id=v_actor where id=v_tamer;
  update public.employees set department_id=v_filial,reports_to_employee_id=v_tamer where id=v_melisa;
  update public.employees set department_id=v_kueche,reports_to_employee_id=v_tamer where id=v_abdulrahim;
  update public.employees set department_id=v_backen,reports_to_employee_id=v_tamer where id=v_tuba;
  update public.employees set department_id=v_acai,reports_to_employee_id=v_tamer where id=v_can;
  update public.employees set department_id=v_barista,reports_to_employee_id=v_tamer where id in(v_bjoern,v_nes,v_nemsa,v_omayma);
  update public.employees set position_title='Inhaber / Geschäftsführung',organization_level=10 where id=v_actor;

  perform public.replace_department_responsibility(v_tenant,v_location,v_filial,v_tamer,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_filial,v_melisa,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_kueche,v_abdulrahim,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_kueche,v_tamer,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_backen,v_tuba,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_backen,v_melisa,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_lager,v_tuba,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_lager,v_tamer,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_acai,v_can,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_acai,v_melisa,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_barista,v_tamer,'hauptverantwortung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);
  perform public.replace_department_responsibility(v_tenant,v_location,v_barista,v_melisa,'stellvertretung',array[1,2,3,4,5,6,7]::smallint[],null,null,v_actor);

  insert into public.organization_positions(tenant_id,location_id,title,position_type,hierarchy_level,sort_order,created_by,legacy_source_id)
  values(v_tenant,null,'Geschäftsführung','geschaeftsfuehrung',10,10,v_actor,'manual:company:position:geschaeftsfuehrung')
  on conflict(tenant_id,legacy_source_id) do update set title=excluded.title,aktiv=true,hierarchy_level=excluded.hierarchy_level,updated_at=now() returning id into v_pos_company;
  insert into public.organization_positions(tenant_id,location_id,department_id,parent_position_id,title,position_type,hierarchy_level,sort_order,created_by,legacy_source_id)
  values(v_tenant,v_location,v_filial,v_pos_company,'Filialleitung Pontstraße','filialleitung',20,20,v_actor,'manual:pontstrasse:position:filialleitung')
  on conflict(tenant_id,legacy_source_id) do update set department_id=excluded.department_id,parent_position_id=excluded.parent_position_id,title=excluded.title,aktiv=true,hierarchy_level=excluded.hierarchy_level,updated_at=now() returning id into v_pos_store;
  insert into public.organization_positions(tenant_id,location_id,department_id,parent_position_id,title,position_type,hierarchy_level,sort_order,created_by,legacy_source_id) values
    (v_tenant,v_location,v_kueche,v_pos_store,'Küchenverantwortung','bereich',40,30,v_actor,'manual:pontstrasse:position:kueche'),
    (v_tenant,v_location,v_backen,v_pos_store,'Backverantwortung','bereich',40,40,v_actor,'manual:pontstrasse:position:backen'),
    (v_tenant,v_location,v_lager,v_pos_store,'Lagerverantwortung','bereich',40,50,v_actor,'manual:pontstrasse:position:lager'),
    (v_tenant,v_location,v_acai,v_pos_store,'Acai-Verantwortung','bereich',40,60,v_actor,'manual:pontstrasse:position:acai'),
    (v_tenant,v_location,v_barista,v_pos_store,'Barista-Team','fachrolle',50,70,v_actor,'manual:pontstrasse:position:barista')
  on conflict(tenant_id,legacy_source_id) do update set department_id=excluded.department_id,parent_position_id=excluded.parent_position_id,title=excluded.title,aktiv=true,hierarchy_level=excluded.hierarchy_level,updated_at=now();
  select id into strict v_pos_kueche from public.organization_positions where tenant_id=v_tenant and legacy_source_id='manual:pontstrasse:position:kueche';
  select id into strict v_pos_backen from public.organization_positions where tenant_id=v_tenant and legacy_source_id='manual:pontstrasse:position:backen';
  select id into strict v_pos_lager from public.organization_positions where tenant_id=v_tenant and legacy_source_id='manual:pontstrasse:position:lager';
  select id into strict v_pos_acai from public.organization_positions where tenant_id=v_tenant and legacy_source_id='manual:pontstrasse:position:acai';
  select id into strict v_pos_barista from public.organization_positions where tenant_id=v_tenant and legacy_source_id='manual:pontstrasse:position:barista';

  insert into public.organization_position_assignments(tenant_id,position_id,employee_id,assignment_role,valid_from,aktiv,assigned_by) values
    (v_tenant,v_pos_company,v_actor,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_store,v_tamer,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_store,v_melisa,'stellvertretung','2026-08-30',true,v_actor),
    (v_tenant,v_pos_kueche,v_abdulrahim,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_backen,v_tuba,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_lager,v_tuba,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_acai,v_can,'inhaber','2026-08-30',true,v_actor),
    (v_tenant,v_pos_barista,v_bjoern,'mitglied','2026-08-30',true,v_actor),
    (v_tenant,v_pos_barista,v_nes,'mitglied','2026-08-30',true,v_actor),
    (v_tenant,v_pos_barista,v_nemsa,'mitglied','2026-08-30',true,v_actor),
    (v_tenant,v_pos_barista,v_omayma,'mitglied','2026-08-30',true,v_actor)
  on conflict(position_id,employee_id,assignment_role,valid_from) do update set aktiv=true,assigned_by=excluded.assigned_by,updated_at=now();

  insert into public.operational_task_templates(
    tenant_id,location_id,department_id,title,description,task_kind,trigger_type,shift_phase,
    due_offset_minutes,assignment_mode,accountable_employee_id,controller_employee_id,
    evidence_requirements,control_required,priority,aktiv,created_by,source_type,source_id,recurrence_rule
  ) values
    (v_tenant,v_location,v_filial,'Tagesstart: Team und offene Punkte prüfen','Besetzung, Abwesenheiten, Vertretungen, überfällige Aufgaben und kritische Meldungen prüfen; Abweichungen sofort dokumentieren.','kontrolle','shift','start',15,'shift_employee',v_tamer,v_actor,'["kommentar"]',true,95,true,v_actor,'pontstrasse_initial','filial-start','{"trigger":"shift"}'),
    (v_tenant,v_location,v_filial,'Schichtabschluss und Übergabe freigeben','Offene Aufgaben, nicht bestandene Kontrollen und Übergaben prüfen. Nichts ohne klare Zuständigkeit in die nächste Schicht geben.','kontrolle','shift','end',15,'shift_employee',v_tamer,v_actor,'["kommentar"]',true,95,true,v_actor,'pontstrasse_initial','filial-close','{"trigger":"shift"}'),
    (v_tenant,v_location,v_kueche,'Küchenstart: Kühlung und Vorbereitung prüfen','Kühltemperaturen, Arbeitsflächen, Handwaschplatz und Vorbereitung kontrollieren; Abweichungen melden.','temperatur','shift','start',20,'shift_employee',v_abdulrahim,v_tamer,'["messwert","kommentar"]',true,90,true,v_actor,'pontstrasse_initial','kitchen-start','{"trigger":"shift"}'),
    (v_tenant,v_location,v_kueche,'Küchenabschluss und Hygiene dokumentieren','Flächen, Geräte, Böden und Abfallbereich reinigen; Abschlusszustand fotografieren und Besonderheiten kommentieren.','reinigung','shift','end',15,'shift_employee',v_abdulrahim,v_tamer,'["foto","kommentar"]',true,95,true,v_actor,'pontstrasse_initial','kitchen-close','{"trigger":"shift"}'),
    (v_tenant,v_location,v_backen,'Backstart: Vorbereitung und Hygiene prüfen','Produktionsfolge, Zutaten, Allergentrennung und saubere Arbeitsmittel vor dem Start bestätigen.','hygiene','shift','start',20,'shift_employee',v_tuba,v_melisa,'["kommentar"]',true,85,true,v_actor,'pontstrasse_initial','bakery-start','{"trigger":"shift"}'),
    (v_tenant,v_location,v_backen,'Backbereich reinigen und Restbestände sichern','Backgeräte und Flächen reinigen, Restbestände beschriften und Abschlusszustand dokumentieren.','reinigung','shift','end',15,'shift_employee',v_tuba,v_melisa,'["foto","kommentar"]',true,90,true,v_actor,'pontstrasse_initial','bakery-close','{"trigger":"shift"}'),
    (v_tenant,v_location,v_lager,'Lagerordnung und Nachfüllbedarf prüfen','Lagerplätze, Laufwege, MHD-Auffälligkeiten und Nachfüllbedarf prüfen; Abweichungen mit Foto melden.','lager','shift','end',20,'shift_employee',v_tuba,v_tamer,'["foto","kommentar"]',true,85,true,v_actor,'pontstrasse_initial','storage-close','{"trigger":"shift"}'),
    (v_tenant,v_location,v_acai,'Acai-Start: Temperatur, Bestand und Sauberkeit','Temperatur messen, Bestand prüfen und saubere Station vor Produktionsbeginn bestätigen.','temperatur','shift','start',15,'shift_employee',v_can,v_melisa,'["messwert","foto"]',true,90,true,v_actor,'pontstrasse_initial','acai-start','{"trigger":"shift"}'),
    (v_tenant,v_location,v_acai,'Acai-Abschluss und Bestandsübergabe','Station reinigen, offene Produkte sichern und Nachfüllbedarf an die nächste Schicht übergeben.','reinigung','shift','end',15,'shift_employee',v_can,v_melisa,'["foto","kommentar"]',true,85,true,v_actor,'pontstrasse_initial','acai-close','{"trigger":"shift"}'),
    (v_tenant,v_location,v_barista,'Barista-Start: Maschine, Mühle und Arbeitsplatz','Maschine, Mühle, Bohnen, Milchalternativen und saubere Arbeitsflächen vor Servicebeginn prüfen.','qualitaet','shift','start',15,'shift_employee',v_tamer,v_melisa,'["kommentar"]',true,80,true,v_actor,'pontstrasse_initial','barista-start','{"trigger":"shift"}'),
    (v_tenant,v_location,v_barista,'Barista-Abschluss: Rückspülen, reinigen, Bestand melden','Maschine rückspülen, Mühle und Flächen reinigen sowie fehlende Ware mit Foto oder Kommentar melden.','reinigung','shift','end',15,'shift_employee',v_tamer,v_melisa,'["foto","kommentar"]',true,85,true,v_actor,'pontstrasse_initial','barista-close','{"trigger":"shift"}')
  on conflict(tenant_id,source_type,source_id) where source_type is not null and source_id is not null
  do update set location_id=excluded.location_id,department_id=excluded.department_id,title=excluded.title,
    description=excluded.description,task_kind=excluded.task_kind,trigger_type=excluded.trigger_type,
    shift_phase=excluded.shift_phase,due_offset_minutes=excluded.due_offset_minutes,
    assignment_mode=excluded.assignment_mode,accountable_employee_id=excluded.accountable_employee_id,
    controller_employee_id=excluded.controller_employee_id,evidence_requirements=excluded.evidence_requirements,
    priority=excluded.priority,aktiv=true,updated_at=now();

  insert into public.operational_tasks(
    tenant_id,location_id,department_id,title,description,status,priority,created_by,assigned_to,
    accountable_employee_id,controller_employee_id,delegated_from_employee_id,due_at,
    evidence_requirements,source_type,source_id
  ) values
    (v_tenant,v_location,v_filial,'Teamzugänge und Stammdaten vervollständigen','Echte E-Mail-Adressen und fehlende Nachnamen sammeln; anschließend Einladungen versenden und erste Anmeldung prüfen.','offen',100,v_actor,v_tamer,v_tamer,v_actor,null,now()+interval '2 days','["kommentar"]','pontstrasse_setup','complete-team-access'),
    (v_tenant,v_location,v_filial,'Verantwortungsbereiche gemeinsam bestätigen','Mit jedem Verantwortlichen Pflichten, Nachweise, Eskalationsweg und Stellvertretung durchgehen.','offen',95,v_actor,v_tamer,v_tamer,v_actor,null,now()+interval '3 days','["kommentar"]','pontstrasse_setup','confirm-responsibilities'),
    (v_tenant,v_location,v_filial,'Vertretungs- und Übergabeplan prüfen','Melisa prüft die eingerichteten Vertretungen und bestätigt, wie offene Punkte bei Krankheit oder Schichtende übernommen werden.','offen',90,v_actor,v_melisa,v_melisa,v_actor,null,now()+interval '3 days','["kommentar"]','pontstrasse_setup','confirm-deputy'),
    (v_tenant,v_location,v_kueche,'Küchenstandard mit Filialleitung abnehmen','Abdulrahim prüft Reinigungsumfang, Temperaturpunkte und benötigte Nachweise gemeinsam mit Tamer.','offen',90,v_actor,v_abdulrahim,v_abdulrahim,v_tamer,null,now()+interval '7 days','["foto","kommentar"]','pontstrasse_setup','confirm-kitchen'),
    (v_tenant,v_location,v_backen,'Back- und Lagerstandard mit Filialleitung abnehmen','Tuba bestätigt Backablauf, Lagerordnung, Allergentrennung und Eskalationsweg.','offen',85,v_actor,v_tuba,v_tuba,v_tamer,null,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-bakery-storage'),
    (v_tenant,v_location,v_acai,'Acai-Standard mit Filialleitung abnehmen','Can bestätigt Temperaturkontrolle, Stationsreinigung, Bestandsübergabe und Qualitätsabweichungen.','offen',85,v_actor,v_can,v_can,v_tamer,null,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-acai'),
    (v_tenant,v_location,v_barista,'Persönlichen Barista-Schichtablauf bestätigen','Björn prüft Start- und Abschlussaufgaben und meldet offene Fragen an die Filialleitung.','offen',70,v_actor,v_bjoern,v_tamer,v_tamer,v_tamer,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-barista-bjoern'),
    (v_tenant,v_location,v_barista,'Persönlichen Barista-Schichtablauf bestätigen','Nes prüft Start- und Abschlussaufgaben und meldet offene Fragen an die Filialleitung.','offen',70,v_actor,v_nes,v_tamer,v_tamer,v_tamer,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-barista-nes'),
    (v_tenant,v_location,v_barista,'Persönlichen Barista-Schichtablauf bestätigen','Nemsa prüft Start- und Abschlussaufgaben und meldet offene Fragen an die Filialleitung.','offen',70,v_actor,v_nemsa,v_tamer,v_tamer,v_tamer,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-barista-nemsa'),
    (v_tenant,v_location,v_barista,'Persönlichen Barista-Schichtablauf bestätigen','Omayma prüft Start- und Abschlussaufgaben und meldet offene Fragen an die Filialleitung.','offen',70,v_actor,v_omayma,v_tamer,v_tamer,v_tamer,now()+interval '7 days','["kommentar"]','pontstrasse_setup','confirm-barista-omayma')
  on conflict(tenant_id,source_type,source_id) where source_type is not null and source_id is not null do nothing;

  insert into public.training_progress(tenant_id,employee_id,module_id,fortschritt_prozent,abgeschlossen)
  select v_tenant,e.employee_id,m.id,0,false
  from unnest(array[v_tamer,v_melisa,v_abdulrahim,v_tuba,v_can,v_bjoern,v_nes,v_nemsa,v_omayma]::uuid[]) e(employee_id)
  join public.training_modules m on m.tenant_id=v_tenant
    and lower(m.titel) in ('allergene','haccp grundlagen','hygiene & haccp')
    and (m.location_id is null or m.location_id=v_location)
  on conflict(employee_id,module_id) do nothing;
  insert into public.training_progress(tenant_id,employee_id,module_id,fortschritt_prozent,abgeschlossen)
  select v_tenant,e.employee_id,m.id,0,false
  from unnest(array[v_bjoern,v_nes,v_nemsa,v_omayma]::uuid[]) e(employee_id)
  join public.training_modules m on m.tenant_id=v_tenant
    and lower(m.titel) in ('espressomaschine','unsere getränke','matcha-grundlagen')
    and (m.location_id is null or m.location_id=v_location)
  on conflict(employee_id,module_id) do nothing;

  if exists(
    select 1 from public.employees where id in(v_tamer,v_melisa,v_abdulrahim,v_tuba,v_can,v_bjoern,v_nes,v_nemsa,v_omayma)
      and email like 'pending+%@mise.local' and auth_user_id is not null
  ) then raise exception 'technical draft address unexpectedly has an Auth identity'; end if;
  select count(*) into v_gap_count from public.v_responsibility_coverage
  where department_id in(v_filial,v_kueche,v_backen,v_lager,v_acai,v_barista)
    and abdeckungsstatus<>'abgedeckt';
  if v_gap_count<>0 then raise exception 'Pontstraße has % uncovered mandatory areas',v_gap_count; end if;
  if (select count(*) from public.operational_task_templates where tenant_id=v_tenant and source_type='pontstrasse_initial' and aktiv)<>11 then
    raise exception 'Pontstraße shift workflow count is not 11';
  end if;
end
$pontstrasse$;

commit;

select 'Pontstraße organization seed passed' as result;
