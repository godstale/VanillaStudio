import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createReadiness, ReadinessProvider } from '../ready';
import { applyCssVars, cssVars } from './cssVars';
import { useDesign } from './context';
import { DesignContextProvider } from './provider';
import type { Design } from './types';

const file: Design = {
  colors: { canvas: '#111111', ink: '#EEEEEE', primary: '#FF5500', accent: '#00CCFF' },
  typography: { display: { fontFamily: '"Instrument Serif", serif', fontSize: '96px', fontWeight: 400 } },
  spacing: { md: '16px', lg: 32 },
  rounded: { md: '12px' },
  hash: 'abc',
};

function Probe() {
  return createElement('output', null, useDesign().colors.primary);
}

const root = () => document.documentElement.style;

describe('cssVars', () => {
  it('names variables like `design.md export --format css-vars`', () => {
    expect(cssVars(file)).toEqual({
      '--color-canvas': '#111111',
      '--color-ink': '#EEEEEE',
      '--color-primary': '#FF5500',
      '--color-accent': '#00CCFF',
      '--spacing-md': '16px',
      '--spacing-lg': '32',
      '--rounded-md': '12px',
    });
  });

  it('applyCssVars removes stale variables and only touches changed ones', () => {
    const style = { setProperty: vi.fn(), removeProperty: vi.fn() };
    applyCssVars(style, { '--a': '1', '--b': '2' }, { '--a': '1', '--c': '3' });
    expect(style.setProperty.mock.calls).toEqual([['--b', '2']]);
    expect(style.removeProperty.mock.calls).toEqual([['--c']]);
  });
});

describe('DesignContextProvider', () => {
  const readiness = createReadiness({ fonts: { ready: Promise.resolve(), load: () => Promise.resolve() } });
  const wrap = (props: { override?: Record<string, string> | null }) =>
    createElement(ReadinessProvider, { value: readiness }, createElement(DesignContextProvider, { file, ...props }, createElement(Probe)));

  it('provides tokens to useDesign() and sets CSS variables', () => {
    const { unmount } = render(wrap({}));
    expect(screen.getByRole('status').textContent).toBe('#FF5500');
    expect(root().getPropertyValue('--color-canvas')).toBe('#111111');
    expect(root().getPropertyValue('--spacing-md')).toBe('16px');
    unmount();
    expect(root().getPropertyValue('--color-canvas')).toBe('');
  });

  it('an override replaces roles without touching the file tokens, and null restores them', () => {
    const { rerender } = render(wrap({}));
    rerender(wrap({ override: { primary: '#00FF00', 'on-primary': '#000000' } }));
    expect(screen.getByRole('status').textContent).toBe('#00FF00');
    expect(root().getPropertyValue('--color-primary')).toBe('#00FF00');
    expect(root().getPropertyValue('--color-canvas')).toBe('#111111');
    expect(root().getPropertyValue('--color-on-primary')).toBe('#000000');
    rerender(wrap({ override: null }));
    expect(screen.getByRole('status').textContent).toBe('#FF5500');
    expect(root().getPropertyValue('--color-primary')).toBe('#FF5500');
    expect(root().getPropertyValue('--color-on-primary')).toBe('');
  });

  it('registers typography web fonts with the readiness signal', () => {
    const load = vi.fn(() => Promise.resolve());
    const r = createReadiness({ fonts: { ready: Promise.resolve(), load } });
    render(createElement(ReadinessProvider, { value: r }, createElement(DesignContextProvider, { file }, null)));
    expect(load).toHaveBeenCalledWith('400 96px "Instrument Serif"', undefined);
  });

  it('follows a new file design (HMR)', () => {
    const { rerender } = render(wrap({}));
    act(() => {
      rerender(createElement(ReadinessProvider, { value: readiness }, createElement(DesignContextProvider, { file: { ...file, colors: { ...file.colors, primary: '#123456' } } }, createElement(Probe))));
    });
    expect(screen.getByRole('status').textContent).toBe('#123456');
    expect(root().getPropertyValue('--color-primary')).toBe('#123456');
  });
});
