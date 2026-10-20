import { describe, expect, it } from 'vitest';
import {
  addComment,
  editCommentBody,
  emptyCommentsFile,
  openCommentCount,
  parseComments,
  removeComment,
  serializeComments,
  setCommentStatus,
} from './comments';

const NOW = '2026-10-17T00:00:00.000Z';
const LATER = '2026-10-17T01:00:00.000Z';

describe('scene comments', () => {
  it('adds a comment with creation history', () => {
    const file = addComment(emptyCommentsFile('scn_1'), '자막을 키우세요', NOW, 'cmt_1');
    expect(file.comments).toHaveLength(1);
    expect(file.comments[0]).toMatchObject({ id: 'cmt_1', body: '자막을 키우세요', status: 'open' });
    expect(file.comments[0].history).toEqual([{ at: NOW, action: 'created' }]);
    expect(openCommentCount(file)).toBe(1);
  });

  it('ignores empty bodies', () => {
    expect(addComment(emptyCommentsFile('scn_1'), '   ', NOW).comments).toHaveLength(0);
  });

  it('done/reopen appends history and flips the open count', () => {
    let file = addComment(emptyCommentsFile('scn_1'), '배경을 어둡게', NOW, 'cmt_1');
    file = setCommentStatus(file, 'cmt_1', 'done', LATER);
    expect(file.comments[0].status).toBe('done');
    expect(file.comments[0].history).toEqual([
      { at: NOW, action: 'created' },
      { at: LATER, action: 'done' },
    ]);
    expect(openCommentCount(file)).toBe(0);
    file = setCommentStatus(file, 'cmt_1', 'open', LATER);
    expect(file.comments[0].status).toBe('open');
    expect(file.comments[0].history.at(-1)).toEqual({ at: LATER, action: 'reopened' });
  });

  it('edits the body with history, removes by id', () => {
    let file = addComment(emptyCommentsFile('scn_1'), '옛 문구', NOW, 'cmt_1');
    file = editCommentBody(file, 'cmt_1', '새 문구', LATER);
    expect(file.comments[0].body).toBe('새 문구');
    expect(file.comments[0].history.at(-1)).toEqual({ at: LATER, action: 'edited' });
    file = removeComment(file, 'cmt_1');
    expect(file.comments).toHaveLength(0);
  });

  it('round-trips through canonical bytes', () => {
    let file = addComment(emptyCommentsFile('scn_1'), '문구 수정', NOW, 'cmt_1');
    file = setCommentStatus(file, 'cmt_1', 'done', LATER);
    const bytes = serializeComments(file);
    expect(bytes.endsWith('\n')).toBe(true);
    expect(parseComments(bytes)).toEqual(file);
    expect(serializeComments(parseComments(bytes))).toBe(bytes);
  });

  it('rejects broken files and unknown ids are no-ops', () => {
    expect(() => parseComments('{nope')).toThrow();
    expect(() => parseComments('{"version":2,"sceneId":"x","comments":[]}')).toThrow();
    const file = addComment(emptyCommentsFile('scn_1'), '문구', NOW, 'cmt_1');
    expect(setCommentStatus(file, 'missing', 'done', LATER)).toBe(file);
    expect(removeComment(file, 'missing')).toBe(file);
  });
});
