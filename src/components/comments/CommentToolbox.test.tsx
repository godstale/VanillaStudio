import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { CommentToolbox } from './CommentToolbox';

vi.mock('@tauri-apps/api/core', () => {
  const store = new Map<string, string>();
  return {
    invoke: vi.fn(async (cmd: string, args: { path: string; contents?: string }) => {
      if (cmd === 'list_dir') {
        const name = args.path.split('/').pop();
        return store.has(`${args.path}/${name}`) || [...store.keys()].some((k) => k.startsWith(`${args.path}/`))
          ? [...store.keys()].filter((k) => k.startsWith(`${args.path}/`)).map((k) => ({ name: k.slice(args.path.length + 1).split('/')[0], is_dir: false }))
          : [];
      }
      if (cmd === 'read_text_file') {
        const text = store.get(args.path);
        if (text === undefined) throw new Error('missing');
        return text;
      }
      if (cmd === 'write_text_file') {
        store.set(args.path, args.contents ?? '');
        return undefined;
      }
      throw new Error(`unexpected ${cmd}`);
    }),
  };
});

const scenes = [{ slug: 'intro', sceneId: 'scn_1', name: 'Intro' }];

function renderBox() {
  return render(
    <LanguageProvider>
      <CommentToolbox root="/w" scenes={scenes} />
    </LanguageProvider>,
  );
}

describe('CommentToolbox', () => {
  it('shows the empty hint and saves a new comment to comments.json', async () => {
    renderBox();
    expect(await screen.findByText(/아직 코멘트가 없습니다|No comments yet/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/수정 사항을 적으세요|Note what you want/), { target: { value: '자막을 키우세요' } });
    fireEvent.click(screen.getByRole('button', { name: /코멘트 남기기|Add comment/ }));
    expect(await screen.findByText('자막을 키우세요')).toBeTruthy();
    expect(screen.getByText(/수정 요청 1|1 requested/)).toBeTruthy();
  });

  it('marks a comment done and reopens it', async () => {
    renderBox();
    fireEvent.change(screen.getByPlaceholderText(/수정 사항을 적으세요|Note what you want/), { target: { value: '배경을 어둡게' } });
    fireEvent.click(screen.getByRole('button', { name: /코멘트 남기기|Add comment/ }));
    await screen.findByText('배경을 어둡게');
    fireEvent.click(screen.getByRole('button', { name: /반영됨으로 표시|Mark done/ }));
    await waitFor(() => expect(screen.getByText(/반영됨|Done/, { selector: 'p' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /다시 열기|Reopen/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /반영됨으로 표시|Mark done/ })).toBeTruthy());
  });
});
