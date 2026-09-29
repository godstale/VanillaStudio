import { describe, expect, it } from 'vitest';
import { resolveAgentAccess } from './access';

describe('resolveAgentAccess', () => {
  it('blocks without a project', () => {
    expect(resolveAgentAccess({ workspaceRoot: null, isTrusted: true })).toEqual({
      allowed: false,
      reason: 'no-project',
    });
  });
  it('blocks until the folder is trusted', () => {
    expect(resolveAgentAccess({ workspaceRoot: '/p', isTrusted: false })).toEqual({
      allowed: false,
      reason: 'untrusted',
    });
  });
  it('allows trusted projects', () => {
    expect(resolveAgentAccess({ workspaceRoot: '/p', isTrusted: true })).toEqual({ allowed: true });
  });
});
