import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene, sceneSchema, type Scene } from '@/lib/scene/schema';
import { SceneInspector } from './SceneInspector';

const scene = newScene({ id: 'scn_AAA', name: 'Intro', type: 'motion', template: 'commercial@1' });

function setup(over: { onSave?: (s: Scene) => Promise<void>; onRename?: (n: string) => Promise<void> } = {}) {
  const onSave = over.onSave ?? vi.fn(async () => undefined);
  const onRename = over.onRename ?? vi.fn(async () => undefined);
  const view = render(
    <LanguageProvider>
      <SceneInspector workspace={{ id: 'ws_1', name: 'W' }} scene={scene} onSave={onSave} onRename={onRename} />
    </LanguageProvider>,
  );
  return { onSave: onSave as ReturnType<typeof vi.fn>, onRename: onRename as ReturnType<typeof vi.fn>, ...view };
}

const tab = (re: RegExp) => screen.getByRole('tab', { name: re });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SceneInspector', () => {
  it('shows the six section tabs; later ones are placeholders', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    fireEvent.click(tab(/레퍼런스|References/));
    expect(screen.getByText(/이후 단계|later step/)).toBeTruthy();
  });

  it('shows type and template read-only', () => {
    setup();
    expect(screen.getByText('commercial@1')).toBeTruthy();
    expect(screen.getByText(/모션 그래픽|Motion graphic/)).toBeTruthy();
  });

  it('autosaves a brief edit after a pause, with the edit applied', async () => {
    const { onSave } = setup();
    const subject = screen.getAllByRole('textbox')[1];
    fireEvent.change(subject, { target: { value: 'Forest library' } });
    expect(onSave).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].brief.subject).toBe('Forest library');
    expect(screen.getByRole('status').textContent).toMatch(/저장됨|Saved/);
  });

  it('collapses rapid edits into one save', async () => {
    const { onSave } = setup();
    const goal = screen.getAllByRole('textbox')[2];
    for (const v of ['a', 'ab', 'abc']) {
      fireEvent.change(goal, { target: { value: v } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0].brief.goal).toBe('abc');
  });

  it('saves pending edits when it unmounts (selection changes)', async () => {
    const { onSave, unmount } = setup();
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'late edit' } });
    unmount();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('reports a failed save', async () => {
    setup({ onSave: vi.fn(async () => Promise.reject(new Error('disk'))) });
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'x' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(screen.getByRole('status').textContent).toMatch(/저장하지 못했습니다|Could not save/);
  });

  it('renames only when the name actually changed', async () => {
    const { onRename } = setup();
    const name = screen.getAllByRole('textbox')[0];
    fireEvent.blur(name);
    await act(async () => {});
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: '  Opening  ' } });
    fireEvent.blur(name);
    await act(async () => {});
    expect(onRename).toHaveBeenCalledWith('Opening');
  });

  it('prompt tab previews the generate prompt with the typed user prompt and copies it', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup();
    fireEvent.click(tab(/프롬프트|Prompt/));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Make it punchy' } });
    const preview = screen.getByTestId('prompt-preview').textContent ?? '';
    expect(preview.startsWith('[workspace: W / scene: Intro]')).toBe(true);
    expect(preview).toContain('Make it punchy');
    fireEvent.click(screen.getByRole('button', { name: /복사|Copy/ }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(preview);
  });

  it('guide tab edits a field, autosaves a valid scene and re-renders on save', async () => {
    const { onSave } = setup();
    fireEvent.click(tab(/가이드|Guide/));
    fireEvent.change(screen.getByLabelText(/^분위기$|^Mood$/), { target: { value: 'warm' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0] as Scene;
    expect(sceneSchema.safeParse(saved).success).toBe(true);
    expect((saved as { visualStyle: { mood: string } }).visualStyle.mood).toBe('warm');
  });

  it('does not save an invalid intermediate state, then saves once it is fixed', async () => {
    const { onSave } = setup();
    fireEvent.click(tab(/가이드|Guide/));
    const hold = screen.getByLabelText(/마지막 유지 시간|Final hold/);
    fireEvent.change(hold, { target: { value: '0.3' } }); // below the 0.7 s rule
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/저장하지 않았습니다|Not saved/);
    fireEvent.change(hold, { target: { value: '0.9' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect((onSave.mock.calls[0][0] as { endCard: { holdSeconds: number } }).endCard.holdSeconds).toBe(0.9);
  });
});
