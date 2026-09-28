import { describe, it, expect } from 'vitest';
import { translate, getDictionary } from '@/lib/i18n';

describe('translate', () => {
  it('returns the ko string for a known key', () => {
    expect(translate('ko', 'workspace.close')).toBe('닫기');
  });

  it('returns the en string when locale is en', () => {
    expect(translate('en', 'workspace.close')).toBe('Close');
  });

  it('falls back to ko when the en table lacks the key', () => {
    const en = getDictionary('en') as Record<string, string>;
    delete en['collections.newItem'];
    expect(translate('en', 'collections.newItem')).toBe(
      getDictionary('ko')['collections.newItem'],
    );
  });

  it('returns the key itself when missing everywhere', () => {
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });

  it('replaces {param} placeholders', () => {
    expect(translate('ko', 'collections.items', { count: 3 })).toBe('3개 항목');
    expect(translate('en', 'editor.meta', { lines: 10, chars: 99 })).toBe(
      '10 lines · 99 chars',
    );
  });
});
