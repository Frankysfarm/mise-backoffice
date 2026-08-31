-- Owner-managed application tests and training/onboarding completion.
--
-- This migration deliberately extends the canonical assessment_*,
-- training_modules, training_progress, employees, departments, locations,
-- operational_tasks and notifications models. It is idempotent so databases
-- that already received the historical GastroFit engine keep their sessions
-- and immutable scoring snapshots.

begin;

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Canonical assessment engine (restored where the historical branch was not
-- installed, extended where it already exists).
-- -------------------------------------------------------------------------

create table if not exists public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  category text not null default 'APPLICATION',
  description text,
  is_system_template boolean not null default false,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PILOT','ACTIVE','RETIRED')),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assessment_templates
  add column if not exists location_id uuid references public.locations(id) on delete set null;

create unique index if not exists assessment_templates_scope_slug_uq
  on public.assessment_templates(
    coalesce(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid),slug
  );
create index if not exists assessment_templates_tenant_status_idx
  on public.assessment_templates(tenant_id,status,location_id,updated_at desc);
create index if not exists assessment_templates_location_fk_idx
  on public.assessment_templates(location_id) where location_id is not null;

create table if not exists public.assessment_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  version text not null,
  scoring_version text not null,
  content_version text not null,
  language text not null default 'de',
  status text not null default 'DRAFT'
    check (status in ('DRAFT','PILOT','ACTIVE','RETIRED')),
  published_at timestamptz,
  created_by uuid references public.employees(id) on delete set null,
  config_json jsonb not null default '{}'::jsonb,
  checksum text not null,
  created_at timestamptz not null default now(),
  unique(template_id,version)
);
create index if not exists assessment_template_versions_template_status_idx
  on public.assessment_template_versions(template_id,status,created_at desc);

create table if not exists public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.assessment_template_versions(id) on delete cascade,
  module_key text not null default 'QUIZ',
  item_key text not null,
  variant_group text not null default 'standard',
  item_type text not null default 'BRANCHING_SCENARIO' check (item_type in (
    'RANK_TASKS','SIMULATION','MULTI_SELECT_VISUAL','ERROR_DETECTION',
    'BRANCHING_SCENARIO','TIMELINE_PLANNER','LEARNING_CARD','RULE_UPDATE'
  )),
  anchor boolean not null default false,
  difficulty numeric(4,2) not null default 1,
  candidate_payload_json jsonb not null,
  server_scoring_config_json jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(version_id,item_key)
);
create index if not exists assessment_items_version_active_idx
  on public.assessment_items(version_id,active,item_key);

create table if not exists public.assessment_template_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  target_type text not null check (target_type in ('department','position')),
  department_id uuid references public.departments(id) on delete cascade,
  position_type text,
  created_at timestamptz not null default now(),
  check (
    (target_type='department' and department_id is not null and position_type is null)
    or (target_type='position' and department_id is null and nullif(trim(position_type),'') is not null)
  )
);
create unique index if not exists assessment_template_department_target_uq
  on public.assessment_template_targets(template_id,department_id)
  where target_type='department';
create unique index if not exists assessment_template_position_target_uq
  on public.assessment_template_targets(template_id,lower(position_type))
  where target_type='position';
create index if not exists assessment_template_targets_scope_idx
  on public.assessment_template_targets(tenant_id,template_id,target_type);
create index if not exists assessment_template_targets_department_fk_idx
  on public.assessment_template_targets(department_id)
  where department_id is not null;

create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.employees(id) on delete cascade,
  template_version_id uuid not null references public.assessment_template_versions(id),
  status text not null default 'INVITED' check (status in (
    'INVITED','NOT_STARTED','IN_PROGRESS','COMPLETED','AWAITING_REVIEW',
    'REVIEWED','NEXT_STAGE_APPROVED','CLOSED'
  )),
  seed bigint not null default 0,
  invite_token_hash text not null unique,
  invited_by uuid references public.employees(id) on delete set null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  device_class text,
  language text not null default 'de',
  current_module text not null default 'QUIZ',
  completion_percentage numeric(5,2) not null default 0
    check (completion_percentage between 0 and 100),
  score_calculated_at timestamptz,
  next_stage_unlocked_at timestamptz,
  approved_by uuid references public.employees(id) on delete set null,
  technical_meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assessment_sessions
  add column if not exists template_id uuid references public.assessment_templates(id) on delete set null;
create index if not exists assessment_sessions_tenant_candidate_idx
  on public.assessment_sessions(tenant_id,candidate_id,created_at desc);
create index if not exists assessment_sessions_status_idx
  on public.assessment_sessions(tenant_id,status,created_at desc);
create index if not exists assessment_sessions_template_fk_idx
  on public.assessment_sessions(template_id) where template_id is not null;

create table if not exists public.assessment_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  item_id uuid not null references public.assessment_items(id),
  module_key text not null default 'QUIZ',
  module_order integer not null default 0,
  item_order integer not null,
  candidate_payload_json jsonb not null,
  server_scoring_snapshot_json jsonb not null,
  shown_at timestamptz,
  completed_at timestamptz,
  response_status text not null default 'PENDING'
    check (response_status in ('PENDING','SHOWN','COMPLETED')),
  unique(session_id,item_order),
  unique(session_id,item_id)
);
create index if not exists assessment_session_items_session_idx
  on public.assessment_session_items(session_id,item_order);
create index if not exists assessment_session_items_item_fk_idx
  on public.assessment_session_items(item_id);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  session_item_id uuid not null references public.assessment_session_items(id) on delete cascade,
  initial_response_json jsonb,
  response_json jsonb not null,
  change_count integer not null default 0,
  first_answered_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  unique(session_id,session_item_id)
);
create index if not exists assessment_responses_item_fk_idx
  on public.assessment_responses(session_item_id);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.assessment_sessions(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.employees(id) on delete cascade,
  overall_score numeric(7,4) not null check (overall_score between 0 and 100),
  score_band text not null check (score_band in ('A','B','C','D')),
  recommendation text not null,
  safety_review_required boolean not null default false,
  critical_error_count integer not null default 0,
  critical_errors_json jsonb not null default '[]'::jsonb,
  confidence text not null default 'HIGH' check (confidence in ('HIGH','MEDIUM','LOW')),
  confidence_reasons jsonb not null default '[]'::jsonb,
  insight_json jsonb not null default '{}'::jsonb,
  metric_json jsonb not null default '{}'::jsonb,
  scoring_version text not null,
  content_version text not null,
  input_checksum text not null,
  result_checksum text not null,
  generated_at timestamptz not null default now()
);
alter table public.assessment_results
  add column if not exists passed boolean,
  add column if not exists earned_points numeric(10,2),
  add column if not exists max_points numeric(10,2),
  add column if not exists outcome_action text,
  add column if not exists outcome_message text;
create index if not exists assessment_results_tenant_score_idx
  on public.assessment_results(tenant_id,overall_score desc,generated_at desc);
create index if not exists assessment_results_candidate_fk_idx
  on public.assessment_results(candidate_id,generated_at desc);

create table if not exists public.assessment_admin_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  result_id uuid not null references public.assessment_results(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  decision text not null check (decision in ('NEXT_STAGE','FURTHER_REVIEW','NOT_PROCEEDING')),
  reason text,
  admin_note text,
  reviewed_by uuid not null references public.employees(id),
  reviewed_at timestamptz not null default now()
);
create index if not exists assessment_admin_reviews_session_idx
  on public.assessment_admin_reviews(session_id,reviewed_at desc);

create table if not exists public.assessment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  session_id uuid references public.assessment_sessions(id) on delete cascade,
  actor_employee_id uuid references public.employees(id) on delete set null,
  actor_type text not null check (actor_type in ('CANDIDATE','EMPLOYEE','SYSTEM')),
  action text not null,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists assessment_audit_logs_tenant_idx
  on public.assessment_audit_logs(tenant_id,created_at desc);
create index if not exists assessment_audit_logs_session_fk_idx
  on public.assessment_audit_logs(session_id) where session_id is not null;

-- -------------------------------------------------------------------------
-- Canonical training tables: enrich the existing modules/progress records.
-- Correct quiz answers live outside training_modules.inhalt so staff cannot
-- retrieve them through an otherwise legitimate module read.
-- -------------------------------------------------------------------------

alter table public.training_modules
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists passing_threshold smallint not null default 80,
  add column if not exists deadline_days integer,
  add column if not exists recurrence_months integer,
  add column if not exists updated_at timestamptz not null default now();

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='training_modules_passing_threshold_check'
      and conrelid='public.training_modules'::regclass
  ) then
    alter table public.training_modules add constraint training_modules_passing_threshold_check
      check (passing_threshold between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='training_modules_deadline_days_check'
      and conrelid='public.training_modules'::regclass
  ) then
    alter table public.training_modules add constraint training_modules_deadline_days_check
      check (deadline_days is null or deadline_days between 1 and 3650);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='training_modules_recurrence_months_check'
      and conrelid='public.training_modules'::regclass
  ) then
    alter table public.training_modules add constraint training_modules_recurrence_months_check
      check (recurrence_months is null or recurrence_months between 1 and 120);
  end if;
end
$constraints$;

create index if not exists training_modules_tenant_active_idx
  on public.training_modules(tenant_id,aktiv,location_id,reihenfolge);
create index if not exists training_modules_department_fk_idx
  on public.training_modules(department_id) where department_id is not null;

create table if not exists public.training_module_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  target_type text not null check (target_type in ('location','department','position')),
  location_id uuid references public.locations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  position_type text,
  created_at timestamptz not null default now(),
  check (
    (target_type='location' and location_id is not null and department_id is null and position_type is null)
    or (target_type='department' and location_id is null and department_id is not null and position_type is null)
    or (target_type='position' and location_id is null and department_id is null and nullif(trim(position_type),'') is not null)
  )
);
create unique index if not exists training_module_location_target_uq
  on public.training_module_targets(module_id,location_id) where target_type='location';
create unique index if not exists training_module_department_target_uq
  on public.training_module_targets(module_id,department_id) where target_type='department';
create unique index if not exists training_module_position_target_uq
  on public.training_module_targets(module_id,lower(position_type)) where target_type='position';
create index if not exists training_module_targets_scope_idx
  on public.training_module_targets(tenant_id,module_id,target_type);
create index if not exists training_module_targets_location_fk_idx
  on public.training_module_targets(location_id) where location_id is not null;
create index if not exists training_module_targets_department_fk_idx
  on public.training_module_targets(department_id) where department_id is not null;

create table if not exists public.training_quiz_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  question_id text not null,
  correct_option_ids jsonb not null,
  points integer not null default 1 check (points between 1 and 100),
  must_pass boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id,question_id),
  check (jsonb_typeof(correct_option_ids)='array' and jsonb_array_length(correct_option_ids)>0)
);
create index if not exists training_quiz_keys_scope_idx
  on public.training_quiz_keys(tenant_id,module_id);

alter table public.training_progress
  add column if not exists status text not null default 'offen',
  add column if not exists assigned_at timestamptz not null default now(),
  add column if not exists due_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists passed_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists assignment_source text not null default 'legacy',
  add column if not exists assigned_by uuid references public.employees(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update public.training_progress
set status=case
  when abgeschlossen then 'bestanden'
  when coalesce(fortschritt_prozent,0)>0 then 'begonnen'
  else 'offen'
end
where status='offen' and (coalesce(abgeschlossen,false) or coalesce(fortschritt_prozent,0)>0);

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='training_progress_status_check'
      and conrelid='public.training_progress'::regclass
  ) then
    alter table public.training_progress add constraint training_progress_status_check
      check (status in ('offen','begonnen','bestanden','ueberfaellig'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='training_progress_attempt_count_check'
      and conrelid='public.training_progress'::regclass
  ) then
    alter table public.training_progress add constraint training_progress_attempt_count_check
      check (attempt_count>=0);
  end if;
end
$constraints$;

create unique index if not exists training_progress_employee_module_uq
  on public.training_progress(employee_id,module_id);
create index if not exists training_progress_owner_dashboard_idx
  on public.training_progress(tenant_id,status,due_at,module_id);
create index if not exists training_progress_employee_status_idx
  on public.training_progress(employee_id,status,due_at);
create index if not exists training_progress_assigned_by_fk_idx
  on public.training_progress(assigned_by) where assigned_by is not null;

create table if not exists public.training_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  progress_id uuid not null references public.training_progress(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  attempt_number integer not null check (attempt_number>0),
  answers_json jsonb not null default '{}'::jsonb,
  earned_points numeric(10,2) not null default 0,
  max_points numeric(10,2) not null default 0,
  score_percent numeric(5,2) not null check (score_percent between 0 and 100),
  passed boolean not null,
  must_pass_failed boolean not null default false,
  submitted_at timestamptz not null default now(),
  unique(progress_id,attempt_number)
);
create index if not exists training_attempts_scope_idx
  on public.training_attempts(tenant_id,module_id,employee_id,submitted_at desc);
create index if not exists training_attempts_progress_fk_idx
  on public.training_attempts(progress_id);

alter table public.operational_tasks
  add column if not exists training_progress_id uuid references public.training_progress(id) on delete set null;
create unique index if not exists operational_tasks_training_progress_uq
  on public.operational_tasks(training_progress_id)
  where training_progress_id is not null and status<>'storniert';

-- Every assessment object and every answer key stays behind server routes.
-- Existing manager policies may remain for compatibility, but revoked grants
-- make the raw Data API surface unavailable to browsers.
do $rls$
declare v_table text;
begin
  foreach v_table in array array[
    'assessment_templates','assessment_template_versions','assessment_items',
    'assessment_template_targets','assessment_sessions','assessment_session_items',
    'assessment_responses','assessment_results','assessment_admin_reviews',
    'assessment_audit_logs','training_module_targets','training_quiz_keys',
    'training_attempts'
  ] loop
    execute format('alter table public.%I enable row level security',v_table);
    execute format('drop policy if exists packet_ca_service_all on public.%I',v_table);
    execute format(
      'create policy packet_ca_service_all on public.%I for all to service_role using (true) with check (true)',v_table
    );
    execute format('revoke all on table public.%I from public,anon,authenticated',v_table);
    execute format('grant all on table public.%I to service_role',v_table);
  end loop;
end
$rls$;

-- Training content is read through scoped server components/APIs. This keeps
-- quiz keys out of the browser while training_progress retains its canonical
-- self/manager RLS policies from the fusion migration.
revoke all on table public.training_modules from anon,authenticated;
grant all on table public.training_modules to service_role;
grant select,insert,update,delete on table public.training_progress to authenticated;
grant all on table public.training_progress to service_role;

-- Atomic, actor-aware save. Every edit publishes a new immutable version; an
-- already assigned session continues to use its original snapshots.
create or replace function public.save_application_assessment_template(
  p_id uuid,
  p_tenant_id uuid,
  p_location_id uuid,
  p_actor_id uuid,
  p_name text,
  p_description text,
  p_passing_threshold integer,
  p_pass_action text,
  p_fail_action text,
  p_pass_message text,
  p_fail_message text,
  p_questions jsonb,
  p_targets jsonb,
  p_active boolean
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_actor record;
  v_template_id uuid:=coalesce(p_id,gen_random_uuid());
  v_version_id uuid:=gen_random_uuid();
  v_version text;
  v_question jsonb;
  v_option jsonb;
  v_target jsonb;
  v_index integer:=0;
  v_question_id text;
  v_department_id uuid;
begin
  select e.rolle::text as rolle,e.location_id,e.status::text as status
  into v_actor
  from public.employees e
  where e.id=p_actor_id and e.tenant_id=p_tenant_id;
  if not found or v_actor.status not in ('aktiv','in_training','in_probe')
    or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor may not manage assessments';
  end if;
  if v_actor.rolle='manager' and p_location_id is distinct from v_actor.location_id then
    raise exception 'manager is outside assessment location';
  end if;
  if p_location_id is not null and not exists(
    select 1 from public.locations l where l.id=p_location_id and l.tenant_id=p_tenant_id
  ) then raise exception 'assessment location is outside tenant'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name))>160 then
    raise exception 'assessment name is invalid';
  end if;
  if p_passing_threshold not between 0 and 100
    or p_pass_action not in ('next_stage','manual_review','reject')
    or p_fail_action not in ('next_stage','manual_review','reject') then
    raise exception 'assessment outcome settings are invalid';
  end if;
  if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1
    or jsonb_array_length(p_questions)>100 then
    raise exception 'assessment needs between 1 and 100 questions';
  end if;
  if jsonb_typeof(coalesce(p_targets,'[]'::jsonb))<>'array' then
    raise exception 'assessment targets are invalid';
  end if;

  if p_id is null then
    insert into public.assessment_templates(
      id,tenant_id,location_id,name,slug,category,description,is_system_template,
      status,created_by,updated_at
    ) values(
      v_template_id,p_tenant_id,p_location_id,trim(p_name),'owner-'||v_template_id,
      'APPLICATION',nullif(trim(p_description),''),false,
      case when p_active then 'ACTIVE' else 'DRAFT' end,p_actor_id,now()
    );
  else
    perform 1 from public.assessment_templates t
    where t.id=p_id and t.tenant_id=p_tenant_id and not t.is_system_template
    for update;
    if not found then raise exception 'assessment template not found'; end if;
    update public.assessment_templates set
      location_id=p_location_id,name=trim(p_name),description=nullif(trim(p_description),''),
      status=case when p_active then 'ACTIVE' else 'DRAFT' end,updated_at=now()
    where id=p_id;
  end if;

  update public.assessment_template_versions
  set status='RETIRED'
  where template_id=v_template_id and status in ('PILOT','ACTIVE');

  v_version:='OWNER_'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'_'||substr(v_version_id::text,1,8);
  insert into public.assessment_template_versions(
    id,template_id,version,scoring_version,content_version,language,status,
    published_at,created_by,config_json,checksum
  ) values(
    v_version_id,v_template_id,v_version,'OWNER_POINTS_V1','OWNER_CONTENT_V1','de','DRAFT',
    null,p_actor_id,
    jsonb_build_object(
      'passingThreshold',p_passing_threshold,
      'passAction',p_pass_action,'failAction',p_fail_action,
      'passMessage',left(coalesce(nullif(trim(p_pass_message),''),'Danke. Der Test wurde erfolgreich abgeschlossen.'),1000),
      'failMessage',left(coalesce(nullif(trim(p_fail_message),''),'Danke. Der Betrieb prüft nun den nächsten Schritt.'),1000)
    ),
    encode(digest(convert_to(coalesce(p_questions,'[]'::jsonb)::text||coalesce(p_targets,'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
  );

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_index:=v_index+1;
    v_question_id:=coalesce(nullif(v_question->>'id',''),'frage-'||v_index);
    if nullif(trim(v_question->>'question'),'') is null
      or jsonb_typeof(v_question->'options')<>'array'
      or jsonb_array_length(v_question->'options')<2
      or jsonb_array_length(v_question->'options')>12
      or jsonb_typeof(v_question->'correctOptionIds')<>'array'
      or jsonb_array_length(v_question->'correctOptionIds')<1
      or coalesce((v_question->>'points')::integer,0) not between 1 and 100 then
      raise exception 'question % is invalid',v_index;
    end if;
    for v_option in select value from jsonb_array_elements(v_question->'options')
    loop
      if nullif(trim(v_option->>'id'),'') is null or nullif(trim(v_option->>'label'),'') is null then
        raise exception 'question % has an invalid option',v_index;
      end if;
    end loop;
    if exists(
      select 1 from jsonb_array_elements_text(v_question->'correctOptionIds') correct(id)
      where not exists(
        select 1 from jsonb_array_elements(v_question->'options') option
        where option->>'id'=correct.id
      )
    ) then raise exception 'question % has an unknown correct option',v_index; end if;

    insert into public.assessment_items(
      version_id,module_key,item_key,variant_group,item_type,anchor,difficulty,
      candidate_payload_json,server_scoring_config_json,active
    ) values(
      v_version_id,'QUIZ',v_question_id,'standard','BRANCHING_SCENARIO',
      coalesce((v_question->>'mustPass')::boolean,false),1,
      jsonb_build_object(
        'title',trim(v_question->>'question'),
        'question',trim(v_question->>'question'),
        'options',v_question->'options',
        'multiple',jsonb_array_length(v_question->'correctOptionIds')>1
      ),
      jsonb_build_object(
        'correctOptionIds',v_question->'correctOptionIds',
        'points',(v_question->>'points')::integer,
        'mustPass',coalesce((v_question->>'mustPass')::boolean,false)
      ),true
    );
  end loop;

  delete from public.assessment_template_targets where template_id=v_template_id;
  for v_target in select value from jsonb_array_elements(coalesce(p_targets,'[]'::jsonb))
  loop
    if v_target->>'type'='department' then
      v_department_id:=(v_target->>'departmentId')::uuid;
      if not exists(
        select 1 from public.departments d
        where d.id=v_department_id and d.tenant_id=p_tenant_id
          and (p_location_id is null or d.location_id=p_location_id)
      ) then raise exception 'assessment department is outside scope'; end if;
      insert into public.assessment_template_targets(tenant_id,template_id,target_type,department_id)
      values(p_tenant_id,v_template_id,'department',v_department_id)
      on conflict do nothing;
    elsif v_target->>'type'='position' and nullif(trim(v_target->>'positionType'),'') is not null then
      insert into public.assessment_template_targets(tenant_id,template_id,target_type,position_type)
      values(p_tenant_id,v_template_id,'position',lower(trim(v_target->>'positionType')))
      on conflict do nothing;
    else
      raise exception 'assessment target is invalid';
    end if;
  end loop;

  update public.assessment_template_versions
  set status=case when p_active then 'ACTIVE' else 'DRAFT' end,
      published_at=case when p_active then now() else null end
  where id=v_version_id;
  insert into public.audit_log(tenant_id,employee_id,action,entity_type,entity_id,payload_after)
  values(p_tenant_id,p_actor_id,case when p_id is null then 'assessment_created' else 'assessment_updated' end,
    'assessment_templates',v_template_id,jsonb_build_object('version_id',v_version_id,'active',p_active));
  return v_template_id;
end
$function$;

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
    coalesce(sum(case when response.response_json->'optionIds'=item.server_scoring_snapshot_json->'correctOptionIds' then (item.server_scoring_snapshot_json->>'points')::numeric else 0 end),0),
    coalesce(bool_or(coalesce((item.server_scoring_snapshot_json->>'mustPass')::boolean,false) and response.response_json->'optionIds'<>item.server_scoring_snapshot_json->'correctOptionIds'),false)
  into v_total,v_earned,v_must_failed from public.assessment_session_items item join public.assessment_responses response on response.session_item_id=item.id where item.session_id=p_session_id;
  v_score:=case when v_total=0 then 0 else round(v_earned/v_total*100,2) end;
  v_passed:=v_score>=coalesce((v_config->>'passingThreshold')::numeric,80) and not v_must_failed;
  v_action:=case when v_passed then v_config->>'passAction' else v_config->>'failAction' end;
  v_message:=case when v_passed then v_config->>'passMessage' else v_config->>'failMessage' end;
  insert into public.assessment_results(session_id,tenant_id,candidate_id,overall_score,score_band,recommendation,safety_review_required,critical_error_count,critical_errors_json,confidence,confidence_reasons,insight_json,metric_json,scoring_version,content_version,input_checksum,result_checksum,passed,earned_points,max_points,outcome_action,outcome_message)
  values(p_session_id,v_session.tenant_id,v_session.candidate_id,v_score,case when v_score>=90 then 'A' when v_score>=75 then 'B' when v_score>=60 then 'C' else 'D' end,case when v_passed then 'NEXT_STAGE' else 'REVIEW' end,v_must_failed,case when v_must_failed then 1 else 0 end,'[]','HIGH','[]','{}',jsonb_build_object('earnedPoints',v_earned,'maxPoints',v_total),'OWNER_POINTS_V1','OWNER_CONTENT_V1',encode(digest(p_session_id::text,'sha256'),'hex'),encode(digest(p_session_id::text||v_score::text,'sha256'),'hex'),v_passed,v_earned,v_total,v_action,v_message);
  update public.assessment_sessions set status=case when v_action='manual_review' then 'AWAITING_REVIEW' else 'COMPLETED' end,completed_at=now(),score_calculated_at=now(),completion_percentage=100,updated_at=now() where id=p_session_id;
  if v_action='next_stage' then update public.employees set status=case when status='wartet_zuteilung' then 'in_probe' else status end where id=v_session.candidate_id and tenant_id=v_session.tenant_id;
  elsif v_action='reject' then update public.employees set status='abgelehnt' where id=v_session.candidate_id and tenant_id=v_session.tenant_id; end if;
  insert into public.assessment_audit_logs(tenant_id,session_id,actor_type,action,details_json) values(v_session.tenant_id,p_session_id,'CANDIDATE','TEST_COMPLETED',jsonb_build_object('passed',v_passed,'score',v_score,'action',v_action));
  return query select v_passed,v_score,v_message;
end
$function$;

create or replace function public.assign_matching_onboarding_trainings(p_tenant_id uuid,p_employee_id uuid,p_actor_id uuid,p_source text default 'onboarding')
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_employee record; v_count integer;
begin
  perform 1 from public.employees actor where actor.id=p_actor_id and actor.tenant_id=p_tenant_id and actor.rolle::text in ('manager','backoffice','admin');
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

create or replace function public.process_overdue_trainings(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_count integer;
begin
  update public.training_progress set status='ueberfaellig',updated_at=p_now where status in ('offen','begonnen') and due_at<p_now;
  get diagnostics v_count=row_count;
  insert into public.operational_tasks(tenant_id,location_id,title,description,status,priority,created_by,assigned_to,accountable_employee_id,due_at,training_progress_id,source_type,source_id,created_at,updated_at)
  select progress.tenant_id,employee.location_id,'Überfällige Pflichtschulung: '||module.titel,employee.vorname||' '||employee.nachname||' benötigt die fällige Schulung.','offen',80,progress.employee_id,progress.employee_id,progress.employee_id,coalesce(progress.due_at,p_now),progress.id,'training_overdue',progress.id::text,p_now,p_now
  from public.training_progress progress join public.training_modules module on module.id=progress.module_id join public.employees employee on employee.id=progress.employee_id where progress.status='ueberfaellig' and module.pflicht
  on conflict(training_progress_id) where training_progress_id is not null and status<>'storniert' do nothing;
  return v_count;
end
$function$;

revoke all on function public.complete_application_assessment(uuid,text) from public,anon,authenticated;
revoke all on function public.assign_matching_onboarding_trainings(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.process_overdue_trainings(timestamptz) from public,anon,authenticated;
grant execute on function public.complete_application_assessment(uuid,text) to service_role;
grant execute on function public.assign_matching_onboarding_trainings(uuid,uuid,uuid,text) to service_role;
grant execute on function public.process_overdue_trainings(timestamptz) to service_role;

create or replace function public.assign_application_assessment(
  p_session_id uuid,
  p_tenant_id uuid,
  p_candidate_id uuid,
  p_template_id uuid,
  p_actor_id uuid,
  p_invite_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_actor record;
  v_candidate record;
  v_template record;
  v_version public.assessment_template_versions%rowtype;
  v_attempt integer;
begin
  select e.rolle::text as rolle,e.location_id,e.status::text as status into v_actor
  from public.employees e where e.id=p_actor_id and e.tenant_id=p_tenant_id;
  if not found or v_actor.status not in ('aktiv','in_training','in_probe')
    or v_actor.rolle not in ('manager','backoffice','admin') then
    raise exception 'actor may not assign assessments';
  end if;
  select e.location_id,e.department_id,e.position_typ,e.status::text as status into v_candidate
  from public.employees e where e.id=p_candidate_id and e.tenant_id=p_tenant_id for update;
  if not found or v_candidate.status not in ('wartet_zuteilung','in_probe') then
    raise exception 'candidate is outside assessment workflow';
  end if;
  select t.location_id,t.status,t.is_system_template into v_template
  from public.assessment_templates t
  where t.id=p_template_id and (t.tenant_id=p_tenant_id or (t.tenant_id is null and t.is_system_template));
  if not found or v_template.status not in ('PILOT','ACTIVE') then
    raise exception 'assessment template is not active';
  end if;
  if v_template.location_id is not null and v_template.location_id is distinct from v_candidate.location_id then
    raise exception 'assessment template is outside candidate location';
  end if;
  if v_actor.rolle='manager' and v_actor.location_id is distinct from v_candidate.location_id then
    raise exception 'manager is outside candidate location';
  end if;
  if exists(select 1 from public.assessment_template_targets where template_id=p_template_id and target_type='department')
    and not exists(
      select 1 from public.assessment_template_targets target
      where target.template_id=p_template_id and target.target_type='department'
        and target.department_id=v_candidate.department_id
    ) then raise exception 'assessment does not match candidate department'; end if;
  if exists(select 1 from public.assessment_template_targets where template_id=p_template_id and target_type='position')
    and not exists(
      select 1 from public.assessment_template_targets target
      where target.template_id=p_template_id and target.target_type='position'
        and lower(target.position_type)=lower(coalesce(v_candidate.position_typ,''))
    ) then raise exception 'assessment does not match candidate position'; end if;
  if exists(
    select 1 from public.assessment_sessions s
    where s.tenant_id=p_tenant_id and s.candidate_id=p_candidate_id
      and coalesce(s.template_id,p_template_id)=p_template_id
      and s.status not in ('CLOSED','NEXT_STAGE_APPROVED')
  ) then raise exception 'candidate already has an open assessment'; end if;
  select * into v_version from public.assessment_template_versions
  where template_id=p_template_id and status in ('PILOT','ACTIVE')
  order by created_at desc limit 1;
  if not found or not exists(select 1 from public.assessment_items where version_id=v_version.id and active) then
    raise exception 'assessment has no published questions';
  end if;
  select coalesce(max(attempt_number),0)+1 into v_attempt
  from public.assessment_sessions where tenant_id=p_tenant_id and candidate_id=p_candidate_id;
  insert into public.assessment_sessions(
    id,tenant_id,candidate_id,template_id,template_version_id,status,seed,
    invite_token_hash,invited_by,attempt_number,expires_at,language,current_module
  ) values(
    p_session_id,p_tenant_id,p_candidate_id,p_template_id,v_version.id,'INVITED',0,
    p_invite_token_hash,p_actor_id,v_attempt,p_expires_at,'de','QUIZ'
  );
  insert into public.assessment_session_items(
    session_id,item_id,module_key,module_order,item_order,candidate_payload_json,
    server_scoring_snapshot_json
  )
  select p_session_id,item.id,'QUIZ',0,
    row_number() over(order by item.created_at,item.item_key)-1,
    item.candidate_payload_json,
    jsonb_build_object('itemKey',item.item_key)||item.server_scoring_config_json
  from public.assessment_items item
  where item.version_id=v_version.id and item.active
  order by item.created_at,item.item_key;
  insert into public.assessment_audit_logs(
    tenant_id,session_id,actor_employee_id,actor_type,action,details_json
  ) values(
    p_tenant_id,p_session_id,p_actor_id,'EMPLOYEE','TEST_ASSIGNED',
    jsonb_build_object('template_id',p_template_id,'version_id',v_version.id,'attempt_number',v_attempt)
  );
  return p_session_id;
end
$function$;

create or replace function public.start_application_assessment(
  p_session_id uuid,p_token_hash text,p_device_class text
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare v_session public.assessment_sessions%rowtype;
begin
  select * into v_session from public.assessment_sessions
  where id=p_session_id and invite_token_hash=p_token_hash for update;
  if not found or v_session.expires_at<=now()
    or v_session.status not in ('INVITED','NOT_STARTED','IN_PROGRESS') then return false; end if;
  update public.assessment_sessions set
    status='IN_PROGRESS',started_at=coalesce(started_at,now()),
    device_class=left(nullif(p_device_class,''),40),updated_at=now()
  where id=p_session_id;
  if v_session.status<>'IN_PROGRESS' then
    insert into public.assessment_audit_logs(tenant_id,session_id,actor_type,action)
    values(v_session.tenant_id,p_session_id,'CANDIDATE','TEST_STARTED');
  end if;
  return true;
end
$function$;

create or replace function public.submit_application_assessment_response(
  p_session_id uuid,p_session_item_id uuid,p_response jsonb
)
returns table(completion_percentage numeric,current_module text)
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_session public.assessment_sessions%rowtype;
  v_item public.assessment_session_items%rowtype;
  v_total integer;
  v_complete integer;
begin
  select * into v_session from public.assessment_sessions where id=p_session_id for update;
  if not found or v_session.status<>'IN_PROGRESS' or v_session.expires_at<=now() then
    raise exception 'assessment session is not active';
  end if;
  select * into v_item from public.assessment_session_items
  where id=p_session_item_id and session_id=p_session_id for update;
  if not found then raise exception 'assessment item is outside session'; end if;
  insert into public.assessment_responses(
    session_id,session_item_id,initial_response_json,response_json,first_answered_at,submitted_at
  ) values(p_session_id,p_session_item_id,p_response,p_response,now(),now())
  on conflict(session_id,session_item_id) do update set
    response_json=excluded.response_json,
    change_count=public.assessment_responses.change_count+
      case when public.assessment_responses.response_json is distinct from excluded.response_json then 1 else 0 end,
    submitted_at=now();
  update public.assessment_session_items set
    response_status='COMPLETED',shown_at=coalesce(shown_at,now()),completed_at=now()
  where id=p_session_item_id;
  select count(*),count(*) filter(where response_status='COMPLETED')
  into v_total,v_complete from public.assessment_session_items where session_id=p_session_id;
  update public.assessment_sessions set
    completion_percentage=round(v_complete::numeric/greatest(v_total,1)*100,2),updated_at=now()
  where id=p_session_id;
  return query select round(v_complete::numeric/greatest(v_total,1)*100,2),'QUIZ'::text;
end
$function$;

revoke all on function public.save_application_assessment_template(uuid,uuid,uuid,uuid,text,text,integer,text,text,text,text,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.assign_application_assessment(uuid,uuid,uuid,uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.start_application_assessment(uuid,text,text) from public,anon,authenticated;
revoke all on function public.submit_application_assessment_response(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_application_assessment_template(uuid,uuid,uuid,uuid,text,text,integer,text,text,text,text,jsonb,jsonb,boolean) to service_role;
grant execute on function public.assign_application_assessment(uuid,uuid,uuid,uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.start_application_assessment(uuid,text,text) to service_role;
grant execute on function public.submit_application_assessment_response(uuid,uuid,jsonb) to service_role;

commit;
