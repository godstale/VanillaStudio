import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@vanilla/runtime', () => {
  it('is picked up by the root test run', () => {
    expect(PACKAGE_NAME).toBe('@vanilla/runtime');
  });
});
