import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene } from '@/lib/scene/schema';
import type { RunReview } from '@/lib/scene/writeback';
import { DiffDialog } from './DiffDialog';

const scene = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });

const ok = (over: Partial<Extract<RunReview, { state: 'ok' }>> = {}): RunReview => ({
  state: 'ok',
  after: scene,
  changes: [
    { field: 'structure', before: 'multi-shot', after: 'hybrid', allowed: true },
    { field: 'name', before: 'Intro', after: 'Hijacked', allowed: false },
  ],
  disallowed: ['name'],
  entryExists: true,
  status: 'generated',
  ...over,
});

function setup(review: RunReview | null) {
  const h = { onApprove: vi.fn(), onRevertDisallowed: vi.fn(), onRevertAll: vi.fn(), onClose: vi.fn() };
  render(
    <LanguageProvider>
      <DiffDialog open review={review} sceneName="Intro" {...h} />
    </LanguageProvider>,
  );
  return h;
}

const btn = (re: RegExp) => screen.getByRole('button', { name: re });

describe('DiffDialog', () => {
  it('lists changes with before/after and warns about fields outside the whitelist', () => {
    setup(ok());
    const list = screen.getByTestId('diff-changes');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(within(list).getByText('− multi-shot')).toBeTruthy();
    expect(within(list).getByText('+ hybrid')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('name');
    expect(within(list).getAllByText(/허용되지 않음|Not allowed/)).toHaveLength(1);
  });

  it('approve, revert disallowed, revert all and later each fire once', () => {
    const h = setup(ok());
    fireEvent.click(btn(/^승인$|^Approve$/));
    fireEvent.click(btn(/허용되지 않은 변경만|Revert only the disallowed/));
    fireEvent.click(btn(/모두 되돌리기|Revert everything/));
    fireEvent.click(btn(/나중에|Later/));
    expect(h.onApprove).toHaveBeenCalledOnce();
    expect(h.onRevertDisallowed).toHaveBeenCalledOnce();
    expect(h.onRevertAll).toHaveBeenCalledOnce();
    expect(h.onClose).toHaveBeenCalledOnce();
  });

  it('without disallowed changes there is no partial revert and no warning', () => {
    setup(ok({ changes: [{ field: 'structure', before: 'a', after: 'b', allowed: true }], disallowed: [] }));
    expect(screen.queryByRole('button', { name: /허용되지 않은 변경만|Revert only the disallowed/ })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tells the user when nothing changed or the entry file is missing', () => {
    setup(ok({ changes: [], disallowed: [], entryExists: false, status: 'needs-revision' }));
    expect(screen.getByText(/변경된 필드가 없습니다|No fields changed/)).toBeTruthy();
    expect(screen.getByText(/엔트리 파일|entry file/)).toBeTruthy();
  });

  it('an invalid scene.json shows the errors and offers only restore (no approve)', () => {
    setup({ state: 'invalid', errors: ['endCard.holdSeconds: too small'] });
    expect(screen.getByRole('alert').textContent).toContain('endCard.holdSeconds');
    expect(screen.queryByRole('button', { name: /^승인$|^Approve$/ })).toBeNull();
    expect(btn(/모두 되돌리기|Revert everything/)).toBeTruthy();
  });

  it('renders nothing without a review', () => {
    setup(null);
    expect(screen.queryByTestId('diff-dialog')).toBeNull();
  });

  it('shows the analysis part and offers a partial revert for edits outside the analysis section', () => {
    const h = {
      onApprove: vi.fn(),
      onRevertDisallowed: vi.fn(),
      onRevertAll: vi.fn(),
      onClose: vi.fn(),
    };
    const analysis = {
      files: [{ path: 'references/analysis/ref-1.md', kind: 'added' as const, before: null, after: 'warm palette, slow cuts' }],
      design: { section: { before: null, after: '- warm' }, outsideChanged: true, broken: false },
      disallowed: true,
    };
    render(
      <LanguageProvider>
        <DiffDialog open review={ok({ changes: [], disallowed: [] })} analysis={analysis} sceneName="Intro" {...h} />
      </LanguageProvider>,
    );
    const part = screen.getByTestId('analysis-diff');
    expect(within(part).getByText('references/analysis/ref-1.md')).toBeTruthy();
    expect(within(part).getByText('warm palette, slow cuts')).toBeTruthy();
    expect(within(part).getAllByRole('alert').length).toBeGreaterThan(0); // outside-section warning
    fireEvent.click(screen.getByRole('button', { name: /허용되지 않은 변경만|disallowed/ }));
    expect(h.onRevertDisallowed).toHaveBeenCalledOnce();
  });

  it('a clean analysis has no partial-revert button', () => {
    const analysis = { files: [{ path: 'references/analysis/ref-1.md', kind: 'changed' as const, before: 'a', after: 'b' }], design: null, disallowed: false };
    render(
      <LanguageProvider>
        <DiffDialog open review={ok({ changes: [], disallowed: [] })} analysis={analysis} sceneName="Intro" onApprove={vi.fn()} onRevertDisallowed={vi.fn()} onRevertAll={vi.fn()} onClose={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.queryByRole('button', { name: /허용되지 않은 변경만|disallowed/ })).toBeNull();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});
