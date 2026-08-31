begin;

-- M3: compare answer IDs as mathematical sets. The lateral subqueries both
-- deduplicate and sort, so client order and duplicate IDs cannot affect score.
create or replace function public.complete_application_assessment(p_session_id uuid,p_token_hash text)
returns table(passed boolean,score_percent numeric,outcome_message text)
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_session public.assessment_sessions%rowtype; v_config jsonb; v_total numeric:=0; v_earned numeric:=0;
  v_must_failed boolean:=false; v_passed boolean; v_score numeric; v_action text; v_message text;
begin
  select * into v_session from public.assessment_sessions where id=p_session_id and invite_token_hash=p_token_hash for update;
  if not found or v_session.status<>'IN_PROGRESS' or v_session.expires_at<=now() then raise exception 'assessment session is not active'; end if;
  if exists(select 1 from public.assessment_session_items where session_id=p_session_id and response_status<>'COMPLETED') then raise exception 'assessment is incomplete'; end if;
  select config_json into v_config from public.assessment_template_versions where id=v_session.template_version_id;
  select coalesce(sum((item.server_scoring_snapshot_json->>'points')::numeric),0),
    coalesce(sum(case when selected.ids=correct.ids then (item.server_scoring_snapshot_json->>'points')::numeric else 0 end),0),
    coalesce(bool_or(coalesce((item.server_scoring_snapshot_json->>'mustPass')::boolean,false) and selected.ids<>correct.ids),false)
  into v_total,v_earned,v_must_failed
  from public.assessment_session_items item
  join public.assessment_responses response on response.session_item_id=item.id
  cross join lateral (select coalesce(array_agg(distinct value order by value),'{}'::text[]) ids from jsonb_array_elements_text(coalesce(response.response_json->'optionIds','[]'::jsonb))) selected
  cross join lateral (select coalesce(array_agg(distinct value order by value),'{}'::text[]) ids from jsonb_array_elements_text(coalesce(item.server_scoring_snapshot_json->'correctOptionIds','[]'::jsonb))) correct
  where item.session_id=p_session_id;
  v_score:=case when v_total=0 then 0 else round(v_earned/v_total*100,2) end;
  v_passed:=v_score>=coalesce((v_config->>'passingThreshold')::numeric,80) and not v_must_failed;
  v_action:=case when v_passed then v_config->>'passAction' else v_config->>'failAction' end;
  v_message:=case when v_passed then v_config->>'passMessage' else v_config->>'failMessage' end;
  insert into public.assessment_results(session_id,tenant_id,candidate_id,overall_score,score_band,recommendation,safety_review_required,critical_error_count,critical_errors_json,confidence,confidence_reasons,insight_json,metric_json,scoring_version,content_version,input_checksum,result_checksum,passed,earned_points,max_points,outcome_action,outcome_message)
  values(p_session_id,v_session.tenant_id,v_session.candidate_id,v_score,case when v_score>=90 then 'A' when v_score>=75 then 'B' when v_score>=60 then 'C' else 'D' end,case when v_passed then 'NEXT_STAGE' else 'REVIEW' end,v_must_failed,case when v_must_failed then 1 else 0 end,'[]','HIGH','[]','{}',jsonb_build_object('earnedPoints',v_earned,'maxPoints',v_total),'OWNER_POINTS_V1','OWNER_CONTENT_V1',encode(extensions.digest(p_session_id::text,'sha256'),'hex'),encode(extensions.digest(p_session_id::text||v_score::text,'sha256'),'hex'),v_passed,v_earned,v_total,v_action,v_message);
  update public.assessment_sessions set status=case when v_action='manual_review' then 'AWAITING_REVIEW' else 'COMPLETED' end,completed_at=now(),score_calculated_at=now(),completion_percentage=100,updated_at=now() where id=p_session_id;
  if v_action='next_stage' then update public.employees set status=case when status='wartet_zuteilung' then 'in_probe' else status end where id=v_session.candidate_id and tenant_id=v_session.tenant_id;
  elsif v_action='reject' then update public.employees set status='abgelehnt' where id=v_session.candidate_id and tenant_id=v_session.tenant_id; end if;
  insert into public.assessment_audit_logs(tenant_id,session_id,actor_type,action,details_json) values(v_session.tenant_id,p_session_id,'CANDIDATE','TEST_COMPLETED',jsonb_build_object('passed',v_passed,'score',v_score,'action',v_action));
  return query select v_passed,v_score,v_message;
end
$function$;

-- m1: former employees cannot assign onboarding trainings.
create or replace function public.assign_matching_onboarding_trainings(p_tenant_id uuid,p_employee_id uuid,p_actor_id uuid,p_source text default 'onboarding')
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_employee record; v_count integer;
begin
  perform 1 from public.employees actor where actor.id=p_actor_id and actor.tenant_id=p_tenant_id and actor.status::text in ('aktiv','in_training','in_probe') and actor.rolle::text in ('manager','backoffice','admin');
  if not found then raise exception 'actor may not assign trainings'; end if;
  select * into v_employee from public.employees where id=p_employee_id and tenant_id=p_tenant_id;
  if not found then raise exception 'employee is outside tenant'; end if;
  insert into public.training_progress(tenant_id,employee_id,module_id,fortschritt_prozent,abgeschlossen,status,assigned_at,due_at,assignment_source,assigned_by)
  select p_tenant_id,p_employee_id,module.id,0,false,'offen',now(),case when module.deadline_days is null then null else now()+make_interval(days=>module.deadline_days) end,left(coalesce(nullif(p_source,''),'manual'),40),p_actor_id
  from public.training_modules module where module.tenant_id=p_tenant_id and module.aktiv and module.pflicht and (module.location_id is null or module.location_id=v_employee.location_id)
    and (not exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='location') or exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='location' and target.location_id=v_employee.location_id))
    and (not exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='department') or exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='department' and target.department_id=v_employee.department_id))
    and (not exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='position') or exists(select 1 from public.training_module_targets target where target.module_id=module.id and target.target_type='position' and lower(target.position_type)=lower(coalesce(v_employee.position_typ,''))))
  on conflict(employee_id,module_id) do nothing;
  get diagnostics v_count=row_count; return v_count;
end
$function$;

-- m2: check-up templates now enforce the same tenant/location boundary as guides.
alter table public.checkup_templates enable row level security;
drop policy if exists checkup_templates_read_scoped on public.checkup_templates;
drop policy if exists checkup_templates_manage_scoped on public.checkup_templates;
create policy checkup_templates_read_scoped on public.checkup_templates for select to authenticated using (
  tenant_id=public.current_tenant_id() and public.can_access_operational_location(tenant_id,location_id)
);
create policy checkup_templates_manage_scoped on public.checkup_templates for all to authenticated using (
  tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id)
) with check (
  tenant_id=public.current_tenant_id() and public.can_manage_operational_location(tenant_id,location_id)
);

-- M1: align concrete-response candidates with every other Vollausbau RPC.
-- Keep the reviewed implementation and replace only its status predicate.
do $m1$
declare v_definition text;
begin
  select pg_get_functiondef('public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid)'::regprocedure) into v_definition;
  v_definition:=replace(v_definition,'e.status::text=''aktiv''','e.status::text in (''aktiv'',''in_training'',''in_probe'')');
  if v_definition not like '%in_training%' then raise exception 'schedule candidate correction did not match reviewed function'; end if;
  execute v_definition;
end $m1$;

-- m5: only an actual cancellation is logged as cancelled.
create or replace function public.record_published_schedule_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_employee uuid; v_change_type text;
begin
  select * into v_week from public.schedule_weeks w where w.tenant_id=new.tenant_id and w.location_id=new.location_id and w.status='published' and (new.start_zeit at time zone 'Europe/Berlin')::date>=w.week_start and (new.start_zeit at time zone 'Europe/Berlin')::date<w.week_start+7;
  if not found or (old.employee_id is not distinct from new.employee_id and old.start_zeit=new.start_zeit and old.end_zeit=new.end_zeit and old.status::text=new.status::text) then return new; end if;
  v_change_type:=case when old.employee_id is distinct from new.employee_id then 'assignment_changed' when new.status::text in ('abgesagt','storniert') and old.status::text not in ('abgesagt','storniert') then 'cancelled' else 'time_changed' end;
  foreach v_employee in array array[old.employee_id,new.employee_id] loop
    if v_employee is not null and not exists(select 1 from public.schedule_publication_changes c where c.schedule_week_id=v_week.id and c.shift_id=new.id and c.employee_id=v_employee and c.change_type=v_change_type and c.changed_at>now()-interval '2 seconds') then
      insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by) values(new.tenant_id,new.location_id,v_week.id,new.id,v_employee,v_change_type,'Geändert seit Veröffentlichung',nullif(current_setting('app.audit_employee_id',true),'')::uuid);
      insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_employee,'info','Dienstplan geändert','Eine veröffentlichte Schicht wurde geändert. Bitte prüfe deinen Dienstplan.','/mitarbeiter#dienstplan');
    end if;
  end loop; return new;
end $function$;

-- m7: only active workflow employees receive publication messages and the
-- outbox has a usable fallback body even without template expansion.
create or replace function public.publish_schedule_week(p_tenant_id uuid,p_location_id uuid,p_actor_id uuid,p_week_start date)
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_week public.schedule_weeks%rowtype; v_employee record; v_count integer:=0;
begin
  if not exists(select 1 from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id and e.status::text in ('aktiv','in_training','in_probe') and e.rolle::text in ('manager','backoffice','admin') and (e.rolle::text in ('backoffice','admin') or e.location_id=p_location_id)) then raise exception 'actor is not allowed'; end if;
  select * into v_week from public.schedule_weeks where tenant_id=p_tenant_id and location_id=p_location_id and week_start=p_week_start for update;
  if not found then raise exception 'schedule week not found'; end if;
  if v_week.status='published' then return 0; end if;
  update public.schedule_weeks set status='published',published_at=now(),published_by=p_actor_id,updated_at=now() where id=v_week.id;
  insert into public.schedule_publication_changes(tenant_id,location_id,schedule_week_id,shift_id,employee_id,change_type,summary,changed_by)
  select p_tenant_id,p_location_id,v_week.id,s.id,s.employee_id,'published','Dienstplan veröffentlicht',p_actor_id from public.shifts s join public.employees e on e.id=s.employee_id and e.status::text in ('aktiv','in_training','in_probe') where s.tenant_id=p_tenant_id and s.location_id=p_location_id and s.employee_id is not null and s.start_zeit>=p_week_start::timestamp at time zone 'Europe/Berlin' and s.start_zeit<(p_week_start+7)::timestamp at time zone 'Europe/Berlin';
  for v_employee in select distinct e.id,e.email from public.shifts s join public.employees e on e.id=s.employee_id where s.tenant_id=p_tenant_id and s.location_id=p_location_id and e.status::text in ('aktiv','in_training','in_probe') and s.start_zeit>=p_week_start::timestamp at time zone 'Europe/Berlin' and s.start_zeit<(p_week_start+7)::timestamp at time zone 'Europe/Berlin' loop
    insert into public.notifications(employee_id,typ,titel,nachricht,link) values(v_employee.id,'info','Dienstplan veröffentlicht','Deine Schichten für die kommende Woche sind jetzt verbindlich.','/mitarbeiter#dienstplan');
    if v_employee.email is not null then insert into public.email_outbox(tenant_id,to_email,subject,html,template,template_data) values(p_tenant_id,v_employee.email,'Dein Dienstplan wurde veröffentlicht','<p>Deine Schichten für die kommende Woche sind jetzt verbindlich. Bitte prüfe deinen Dienstplan.</p>','schedule_published',jsonb_build_object('employee_id',v_employee.id,'week_start',p_week_start)); end if;
    v_count:=v_count+1;
  end loop; return v_count;
end $function$;

-- m4/m9: retain transfer quantity in the audit and persist a QR count as the
-- item's canonical current stock before recording the canonical count event.
do $inventory$
declare v_definition text;
begin
  select pg_get_functiondef('public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid)'::regprocedure) into v_definition;
  v_definition:=replace(v_definition,$old$(v_item.id,p_location_id,'transfer',0,v_before,v_after,'inventory_shelf',p_place_id,p_actor_id,'Umlagerung Ausgang nach '||v_target.name),
      (v_item.id,p_location_id,'transfer',0,v_before,v_after,'inventory_shelf',v_target.id,p_actor_id,'Umlagerung Eingang von '||v_source.name)$old$,$new$(v_item.id,p_location_id,'transfer',-p_amount,v_before,v_after,'inventory_shelf',p_place_id,p_actor_id,'Umlagerung Ausgang nach '||v_target.name),
      (v_item.id,p_location_id,'transfer',p_amount,v_before,v_after,'inventory_shelf',v_target.id,p_actor_id,'Umlagerung Eingang von '||v_source.name)$new$);
  v_definition:=replace(v_definition,$old$elsif p_action<>'count' then update public.inventory_items set letzte_inventur=v_after,updated_at=now() where id=v_item.id; end if;
  if p_action='transfer' then$old$,$new$elsif p_action<>'count' then update public.inventory_items set letzte_inventur=v_after,updated_at=now() where id=v_item.id; end if;
  if p_action='count' then update public.inventory_items set letzte_inventur=v_after,updated_at=now() where id=v_item.id; end if;
  if p_action='transfer' then$new$);
  if v_definition not like '%''transfer'',-p_amount%' or v_definition not like '%''transfer'',p_amount%' or v_definition not like '%p_action=''count'' then update public.inventory_items%' then raise exception 'inventory correction did not match reviewed function'; end if;
  execute v_definition;
end $inventory$;

revoke all on function public.complete_application_assessment(uuid,text) from public,anon,authenticated;
revoke all on function public.assign_matching_onboarding_trainings(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) from public,anon,authenticated;
revoke all on function public.publish_schedule_week(uuid,uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) from public,anon,authenticated;
grant execute on function public.complete_application_assessment(uuid,text) to service_role;
grant execute on function public.assign_matching_onboarding_trainings(uuid,uuid,uuid,text) to service_role;
grant execute on function public.generate_weekly_shift_assignment_suggestions_v1(uuid,uuid,date,uuid) to service_role;
grant execute on function public.publish_schedule_week(uuid,uuid,uuid,date) to service_role;
grant execute on function public.record_inventory_place_action_as_actor(uuid,uuid,uuid,uuid,uuid,text,numeric,uuid) to service_role;
notify pgrst,'reload schema';
commit;
