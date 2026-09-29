import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: state.invoke }));

import {
  buildRevisionPrompt,
  createRevision,
  formatRevisionDoc,
  isRevisionId,
  listRevisions,
  nextRevisionId,
  parseRevisionDoc,
  readRevision,
  requestRevisionFix,
  setRevisionStatus,
} from './revision';

beforeEach(() => {
  state.invoke.mockReset();
});

const DOC = `---
id: R-001
target: s1-intro
t: 1.5
status: open
createdAt: 2026-01-01T00:00:00Z
screenshot: R-001.png.b64
---

Please make the title bigger.
`;

describe('parseRevisionDoc', () => {
  it('parses a full file', () => {
    expect(parseRevisionDoc(DOC)).toMatchObject({
      id: 'R-001',
      target: 's1-intro',
      t: 1.5,
      status: 'open',
      screenshot: 'R-001.png.b64',
      comment: 'Please make the title bigger.',
    });
  });

  it('accepts a minimal file and rejects malformed ones', () => {
    expect(parseRevisionDoc('---\nid: R-002\ntarget: s2\n---\n\nok\n')).toMatchObject({
      id: 'R-002',
      t: null,
      screenshot: null,
      status: 'open',
    });
    expect(parseRevisionDoc('no front matter')).toBeNull();
    expect(parseRevisionDoc('---\nid: R-002\ntarget: s2\n')).toBeNull();
    expect(parseRevisionDoc('---\nid: R-02\ntarget: s2\nstatus: open\n---\n\nx\n')).toBeNull();
    expect(parseRevisionDoc('---\nid: R-002\ntarget: s2\nstatus: bogus\n---\n\nx\n')).toBeNull();
    expect(parseRevisionDoc('---\nid: R-002\ntarget: s2\nstatus: open\n---\n')).toBeNull();
  });

  it('round-trips through formatRevisionDoc', () => {
    const rev = parseRevisionDoc(DOC);
    expect(rev).not.toBeNull();
    expect(parseRevisionDoc(formatRevisionDoc(rev!))).toEqual(rev);
  });
});

describe('isRevisionId', () => {
  it('accepts R-NNN only', () => {
    expect(isRevisionId('R-001')).toBe(true);
    expect(isRevisionId('R-1')).toBe(false);
    expect(isRevisionId('../R-001')).toBe(false);
  });
});

function dirWith(names: string[]) {
  state.invoke.mockImplementation((cmd: string) => {
    if (cmd === 'list_dir') return Promise.resolve(names.map((name) => ({ name, is_dir: false })));
    return Promise.reject(new Error(`unexpected ${cmd}`));
  });
}

describe('nextRevisionId', () => {
  it('continues the R-NNN sequence', async () => {
    dirWith(['R-001.md', 'R-002.md', 'notes.txt']);
    await expect(nextRevisionId('C:/proj')).resolves.toBe('R-003');
  });

  it('starts at R-001 without a reviews folder', async () => {
    state.invoke.mockRejectedValue(new Error('no dir'));
    await expect(nextRevisionId('C:/proj')).resolves.toBe('R-001');
  });
});

describe('createRevision', () => {
  it('writes the doc and the screenshot sidecar', async () => {
    dirWith([]);
    state.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_dir') return Promise.resolve([]);
      if (cmd === 'write_text_file') return Promise.resolve();
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    const rev = await createRevision(
      'C:/proj',
      { target: 's1', t: 2, comment: ' Brighter. ', captureDataUrl: 'data:image/png;base64,iVBORw==', },
      () => '2026-02-01T00:00:00Z',
    );
    expect(rev).toMatchObject({ id: 'R-001', target: 's1', t: 2, status: 'open', screenshot: 'R-001.png.b64' });
    const writes = state.invoke.mock.calls.filter(([c]) => c === 'write_text_file');
    expect(writes).toHaveLength(2);
    expect(writes[0][1]).toMatchObject({ workspaceRoot: 'C:/proj' });
    expect(String(writes[0][1].path)).toContain('R-001.png.b64');
    expect(writes[0][1].contents).toBe('iVBORw==');
    expect(String(writes[1][1].path)).toContain('R-001.md');
  });

  it('works without a screenshot and rejects bad input', async () => {
    dirWith([]);
    state.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_dir') return Promise.resolve([]);
      if (cmd === 'write_text_file') return Promise.resolve();
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    const rev = await createRevision('C:/proj', { target: 's1', t: null, comment: 'ok' });
    expect(rev.screenshot).toBeNull();
    await expect(createRevision('C:/proj', { target: 's1', t: null, comment: '  ' })).rejects.toThrow();
    await expect(createRevision('C:/proj', { target: '../x', t: null, comment: 'x' })).rejects.toThrow();
    await expect(
      createRevision('C:/proj', { target: 's1', t: -1, comment: 'x' }),
    ).rejects.toThrow();
  });
});

describe('listRevisions and readRevision', () => {
  it('reads the numbered docs in order', async () => {
    state.invoke.mockImplementation((cmd: string, args: { path: string }) => {
      if (cmd === 'list_dir') return Promise.resolve([{ name: 'R-001.md', is_dir: false }]);
      if (cmd === 'read_text_file') {
        return args.path.includes('R-001.md') ? Promise.resolve(DOC) : Promise.reject(new Error('missing'));
      }
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    await expect(listRevisions('C:/proj')).resolves.toHaveLength(1);
    await expect(readRevision('C:/proj', 'R-001')).resolves.toMatchObject({ id: 'R-001' });
    await expect(readRevision('C:/proj', 'R-009')).resolves.toBeNull();
    await expect(readRevision('C:/proj', 'bogus')).resolves.toBeNull();
  });
});

describe('setRevisionStatus', () => {
  it('rewrites the doc with the new status', async () => {
    // readRevision uses readOptionalFile (list_dir + read_text_file).
    state.invoke.mockImplementation((cmd: string, call: { path: string }) => {
      if (cmd === 'list_dir') return Promise.resolve([{ name: 'R-001.md', is_dir: false }]);
      if (cmd === 'read_text_file') return Promise.resolve(DOC);
      if (cmd === 'write_text_file') {
        expect(String(call.path)).toContain('R-001.md');
        return Promise.resolve();
      }
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    const next = await setRevisionStatus('C:/proj', 'R-001', 'applied');
    expect(next?.status).toBe('applied');
    const written = state.invoke.mock.calls.find(([c]) => c === 'write_text_file')?.[1].contents as string;
    expect(written).toContain('status: applied');
  });
});

describe('buildRevisionPrompt', () => {
  it('references the review file by path', () => {
    const prompt = buildRevisionPrompt('reviews/R-001.md', 'Fix it', 'en');
    expect(prompt).toContain('`reviews/R-001.md`');
    expect(prompt).toContain('Fix it');
  });
});

describe('requestRevisionFix', () => {
  function fileCalls() {
    state.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'list_dir') return Promise.resolve([{ name: 'R-001.md', is_dir: false }]);
      if (cmd === 'read_text_file') return Promise.resolve(DOC);
      if (cmd === 'write_text_file') return Promise.resolve();
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
  }

  it('marks applied and checkpoints after end_turn', async () => {
    fileCalls();
    const sent: string[] = [];
    const outcome = await requestRevisionFix('C:/proj', parseRevisionDoc(DOC)!, {
      send: (p) => {
        sent.push(p);
        return Promise.resolve('end_turn');
      },
      checkpoint: () => Promise.resolve('abc123'),
    });
    expect(outcome).toMatchObject({ stopReason: 'end_turn', commit: 'abc123', applied: true });
    expect(sent[0]).toContain('`reviews/R-001.md`');
    const statuses = state.invoke.mock.calls
      .filter(([c]) => c === 'write_text_file')
      .map(([, a]) => (a.contents as string).match(/^status: (\w+)/m)?.[1]);
    expect(statuses).toEqual(['sent', 'applied']);
  });

  it('leaves the request sent when the turn fails', async () => {
    fileCalls();
    const outcome = await requestRevisionFix('C:/proj', parseRevisionDoc(DOC)!, {
      send: () => Promise.resolve('refusal'),
      checkpoint: () => Promise.resolve('never'),
    });
    expect(outcome).toMatchObject({ stopReason: 'refusal', commit: null, applied: false });
  });
});
