import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve('supabase/migrations/20260831100944_application_assessments_training_onboarding.sql'), 'utf8');

describe('packet C-A database security', () => {
  it('keeps answer keys and assessments behind service routes', () => {
    expect(sql).toContain("revoke all on table public.training_modules from anon,authenticated");
    expect(sql).toContain("'assessment_templates','assessment_template_versions','assessment_items'");
    expect(sql).toContain('grant execute on function public.complete_application_assessment(uuid,text) to service_role');
    expect(sql).not.toMatch(/grant execute on function public\.complete_application_assessment[^\n]+authenticated/);
  });

  it('checks actor, tenant and location in privileged workflows', () => {
    expect(sql).toContain("where e.id=p_actor_id and e.tenant_id=p_tenant_id");
    expect(sql).toContain("manager is outside assessment location");
    expect(sql).toContain("employee is outside tenant");
    expect(sql).toContain("if v_actor.rolle='manager' then v_location_id:=v_existing_location_id; end if");
    expect(sql).toContain('(v_location_id is null or d.location_id=v_location_id)');
  });

  it('resolves pgcrypto from the production extension schema', () => {
    expect(sql).toContain('create schema if not exists extensions');
    expect(sql).toContain('create extension if not exists pgcrypto with schema extensions');
    expect(sql).toContain('alter extension pgcrypto set schema extensions');
    expect(sql.match(/extensions\.digest\(/g)).toHaveLength(3);
    expect(sql).not.toMatch(/(?<!extensions\.)digest\(/);
  });

  it('feeds overdue required training into canonical operational tasks', () => {
    expect(sql).toContain("add column if not exists training_progress_id");
    expect(sql).toContain("'training_overdue',progress.id::text");
    expect(sql).toContain('process_overdue_trainings');
  });
});
