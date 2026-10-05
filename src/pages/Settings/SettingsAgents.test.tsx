import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { MemorySqlFallback, setDatabase } from '@/lib/db/client';
import { loadAgents } from '@/lib/agents/registry';
import { getGlobalDatabase } from '@/lib/db/client';
import { SettingsAgents } from './SettingsAgents';

// MemorySqlFallback은 agents 테이블 SQL을 해석하지 못하므로 최소 해석기를 얹는다(행 저장·조회만).
class AgentsDb extends MemorySqlFallback {
  rows = new Map<string, Record<string, unknown>>();
  override async execute(query: string, binds: unknown[] = []) {
    if (query.includes('INSERT INTO agents')) {
      const [id, name, command, args, enabled, is_default] = binds;
      this.rows.set(id as string, { id, name, command, args, env: '{}', session_options: '{}', support_tier: 'experimental', enabled, is_default });
      return { rowsAffected: 1 };
    }
    return super.execute(query, binds);
  }
  override async select<T>(query: string): Promise<T> {
    if (query.includes('FROM agents')) return [...this.rows.values()] as T;
    return super.select<T>(query);
  }
}

function renderPage() {
  return render(
    <LanguageProvider>
      <SettingsAgents />
    </LanguageProvider>,
  );
}

beforeEach(() => setDatabase(new AgentsDb()));

describe('SettingsAgents', () => {
  it('lists the five built-in agents and states who manages shell permissions', async () => {
    renderPage();
    const list = await screen.findByTestId('agent-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText(/CLI.*직접 관리|managed by that CLI/)).toBeTruthy();
    expect((screen.getByLabelText(/Claude Code 기본|Claude Code Default/) as HTMLInputElement).checked).toBe(true);
  });

  it('asks for confirmation before saving new arguments and shows the exact command', async () => {
    renderPage();
    const input = await screen.findByLabelText(/Codex 추가 인자|Codex Extra arguments/);
    fireEvent.change(input, { target: { value: '--model "gpt x"' } });
    const row = input.closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /^저장$|^Save$/ }));
    expect((await screen.findByTestId('confirm-command')).textContent).toBe('codex --model gpt x');
    const db = (await getGlobalDatabase()) as AgentsDb;
    expect(db.rows.has('codex')).toBe(false); // nothing is stored before the user confirms
    fireEvent.click(screen.getByRole('button', { name: /확인하고 저장|Confirm and save/ }));
    await waitFor(() => expect(db.rows.get('codex')?.args).toBe('["--model","gpt x"]'));
    expect((await loadAgents(db)).find((a) => a.id === 'codex')?.argv).toEqual(['codex', '--model', 'gpt x']);
  });

  it('cancelling the dialog stores nothing; the save button needs a change and valid quotes', async () => {
    renderPage();
    const input = await screen.findByLabelText(/Codex 추가 인자|Codex Extra arguments/);
    const row = input.closest('li')!;
    const save = within(row).getByRole('button', { name: /^저장$|^Save$/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '--x "oops' } });
    expect(save.disabled).toBe(true);
    expect(within(row).getByRole('alert')).toBeTruthy();
    fireEvent.change(input, { target: { value: '--x' } });
    fireEvent.click(save);
    fireEvent.click(await screen.findByRole('button', { name: /^취소$|^Cancel$/ }));
    const db = (await getGlobalDatabase()) as AgentsDb;
    expect(db.rows.size).toBe(0);
  });

  it('changes the default agent and disables an agent', async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText(/Codex 기본|Codex Default/));
    const db = (await getGlobalDatabase()) as AgentsDb;
    await waitFor(() => expect(db.rows.get('codex')?.is_default).toBe(1));
    const row = screen.getByLabelText(/OpenCode 추가 인자|OpenCode Extra arguments/).closest('li')!;
    fireEvent.click(within(row).getAllByRole('checkbox')[0]);
    await waitFor(() => expect(db.rows.get('opencode')?.enabled).toBe(0));
    expect((within(row).getByRole('radio') as HTMLInputElement).disabled).toBe(true);
  });
});
