import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@vanilla/export-worker', () => {
  it('is picked up by the root test run', () => {
    expect(PACKAGE_NAME).toBe('@vanilla/export-worker');
  });
});
