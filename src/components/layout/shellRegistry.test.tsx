import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { getDictionary } from '@/lib/i18n';
import {
  ACTIVITY_ITEMS,
  STAGE_TAB_ITEMS,
} from '@/components/layout/shellRegistry';
import { EmptyTabView } from '@/components/workspace/EmptyTabView';
import { EmptyPanel } from '@/components/sidepanel/EmptyPanel';

describe('shell registry', () => {
  it('has i18n keys in both dictionaries for every entry', () => {
    const keys = [
      ...ACTIVITY_ITEMS.map((i) => i.labelKey),
      ...STAGE_TAB_ITEMS.map((i) => i.titleKey),
    ];
    for (const locale of ['ko', 'en'] as const) {
      const dict = getDictionary(locale) as Record<string, string>;
      for (const key of keys)
        expect(dict[key], `${locale}:${key}`).toBeTruthy();
    }
  });

  it('registers the five activity views', () => {
    expect(ACTIVITY_ITEMS.map((i) => i.view)).toEqual([
      'pipeline',
      'explorer',
      'agent',
      'templates',
      'playground',
    ]);
  });

  it.each(STAGE_TAB_ITEMS)('opens the $type tab as an empty view', (item) => {
    renderWithProviders(
      <EmptyTabView
        tab={{ id: `${item.type}:main`, type: item.type, title: item.type }}
      />,
    );
    expect(screen.getByTestId(`empty-tab-${item.type}`)).toBeTruthy();
  });

  it.each(['pipeline', 'agent', 'templates', 'playground'] as const)(
    'renders the %s panel empty',
    (view) => {
      renderWithProviders(<EmptyPanel view={view} />);
      expect(screen.getByTestId(`empty-panel-${view}`)).toBeTruthy();
    },
  );
});
