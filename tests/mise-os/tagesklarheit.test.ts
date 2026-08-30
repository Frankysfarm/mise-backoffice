import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KlarheitClient } from '@/app/(neo)/neo/app/klarheit/klarheit-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ toString: () => '' }),
}));

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Tagesklarheit page', () => {
  it('ships a server page, client component, styles and a nav entry', () => {
    const page = source('app/(neo)/neo/app/klarheit/page.tsx');
    const client = source('app/(neo)/neo/app/klarheit/klarheit-client.tsx');
    const styles = source('app/(neo)/neo/app/klarheit/klarheit.module.css');
    const shell = source('app/(neo)/neo/app/shell.tsx');
    const error = source('app/(neo)/neo/app/klarheit/error.tsx');
    const loading = source('app/(neo)/neo/app/klarheit/loading.tsx');

    expect(page).toContain('requireManagerPlus');
    expect(page).toContain('createServiceClient');
    expect(page).toContain("from('shifts')");
    expect(page).toContain("from('operational_tasks')");
    expect(page).toContain("from('v_responsibility_coverage')");
    expect(page).toContain("from('availability_exceptions')");
    expect(page).toContain('berlinTodayBounds');
    expect(page).toContain('todayDate');
    expect(page).toContain('KlarheitClient');
    expect(page).toContain(".not('status', 'in', '(abgesagt,storniert)')");
    expect(page).toContain(".lt('due_at', todayEnd.toISOString())");
    expect(page).not.toContain('grund');

    expect(client).toContain('Heute im Dienst');
    expect(client).toContain('Aufgaben heute');
    expect(client).toContain('Abdeckungslücken');
    expect(client).toContain('Abwesend heute');
    expect(client).toContain('Heute keine Schichten geplant');
    expect(client).toContain('Alle Bereiche sind abgedeckt');
    expect(client).toContain('Heute niemand abwesend gemeldet');

    expect(styles).toContain('@media(max-width:700px)');
    expect(styles).toContain('.hero');
    expect(styles).toContain('.section');
    expect(styles).toContain('.cardAlert');
    expect(error).toContain('Tagesklarheit konnte nicht geladen werden');
    expect(loading).toContain('Tagesklarheit wird geladen');

    expect(shell).toContain("['klarheit', 'Tagesklarheit']");
    expect(shell).toContain("klarheit: ['Tagesklarheit'");
    expect(shell).toContain("'klarheit', 'bewerbungen'");
  });

  it('renders shifts grouped by department, tasks and coverage gaps', () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEnd = new Date(`${today}T23:59:59.000Z`).toISOString();
    const now = new Date(`${today}T12:00:00.000Z`).toISOString();

    const props: ComponentProps<typeof KlarheitClient> = {
      actorId: '40000000-0000-0000-0000-000000000001',
      locationId: '20000000-0000-0000-0000-000000000001',
      locations: [{ id: '20000000-0000-0000-0000-000000000001', name: 'Hauptlocation', stadt: 'Berlin' }],
      canSelectLocation: false,
      departments: [
        { id: '30000000-0000-0000-0000-000000000001', name: 'Küche', aktiv: true, prioritaet: 80 },
        { id: '30000000-0000-0000-0000-000000000002', name: 'Service', aktiv: true, prioritaet: 60 },
      ],
      employees: [
        { id: '40000000-0000-0000-0000-000000000001', vorname: 'Mara', nachname: 'Leitung', rolle: 'manager', position_title: 'Betriebsleitung', department_id: null },
        { id: '40000000-0000-0000-0000-000000000002', vorname: 'Eli', nachname: 'Koch', rolle: 'cook', position_title: 'Küchenchef', department_id: '30000000-0000-0000-0000-000000000001' },
      ],
      shifts: [
        {
          id: '50000000-0000-0000-0000-000000000001',
          start_zeit: `${today}T08:00:00.000Z`,
          end_zeit: `${today}T16:00:00.000Z`,
          status: 'scheduled',
          position: 'Küchenchef',
          typ: 'normal',
          employee: { id: '40000000-0000-0000-0000-000000000002', vorname: 'Eli', nachname: 'Koch', rolle: 'cook', position_title: 'Küchenchef' },
          department: { id: '30000000-0000-0000-0000-000000000001', name: 'Küche' },
        },
      ],
      tasks: [
        {
          id: '60000000-0000-0000-0000-000000000001',
          department_id: '30000000-0000-0000-0000-000000000001',
          title: 'Kühltemperatur prüfen',
          status: 'offen',
          priority: 70,
          due_at: `${today}T09:00:00.000Z`,
          escalation_level: 1,
          assigned_to: '40000000-0000-0000-0000-000000000002',
          assignee: { vorname: 'Eli', nachname: 'Koch' },
        },
      ],
      coverage: [
        {
          department_id: '30000000-0000-0000-0000-000000000002',
          name: 'Service',
          prioritaet: 60,
          hauptverantwortlicher_id: null,
          stellvertretung_id: null,
          aktuell_zustaendig_id: null,
          hauptverantwortlicher_abwesend: false,
          abdeckungsstatus: 'hauptverantwortung_fehlt',
        },
      ],
      absences: [
        {
          id: '70000000-0000-0000-0000-000000000001',
          employee_id: '40000000-0000-0000-0000-000000000001',
          datum: today,
          typ: 'krank',
          employee: { id: '40000000-0000-0000-0000-000000000001', vorname: 'Mara', nachname: 'Leitung', rolle: 'manager', position_title: 'Betriebsleitung' },
        },
      ],
      todayDate: today,
      todayEnd,
      now,
    };

    render(createElement(KlarheitClient, props));

    expect(screen.getByText('Heute im Dienst')).toBeInTheDocument();
    expect(screen.getAllByText('Küche').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Eli Koch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Aufgaben heute')).toBeInTheDocument();
    expect(screen.getByText('Kühltemperatur prüfen')).toBeInTheDocument();
    expect(screen.getByText('Abdeckungslücken')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Hauptverantwortung fehlt')).toBeInTheDocument();
    expect(screen.getByText('Abwesend heute')).toBeInTheDocument();
    expect(screen.getByText('Mara Leitung')).toBeInTheDocument();
    expect(screen.getByText('Krank')).toBeInTheDocument();
  });
});
