import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene } from '@/lib/scene/schema';
import { addNode, newSequence } from '@/lib/sequence/schema';
import { StatusCards } from './StatusCards';

const DESIGN = `---
version: alpha
colors:
  primary: "#2563EB"
  ink: "#14161C"
---

# Deck
`;

function props() {
  const a = newScene({ id: 'scn_a', name: 'Alpha', type: 'static', template: 'opus-narrative-deck@1' });
  const b = newScene({ id: 'scn_b', name: 'Beta', type: 'static', template: 'opus-narrative-deck@1' });
  let s = newSequence('ws_1');
  s = addNode(s, 'scn_a', { x: 0, y: 0 });
  s = addNode(s, 'scn_b', { x: 320, y: 0 });
  const sequence = {
    ...s,
    start: 'scn_a',
    edges: [
      { from: 'scn_a', to: 'scn_b', trigger: 'key:ArrowRight', transition: { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} } },
    ],
  };
  return {
    workspaceName: 'W',
    canvas: { width: 1920, height: 1080, fps: 30 },
    sequence,
    seqError: null,
    issues: [],
    scenes: [
      { slug: 'alpha', scene: a, hasDesignOverride: false, hasGuide: true },
      { slug: 'beta', scene: b, hasDesignOverride: false, hasGuide: false },
    ],
    designText: DESIGN,
    changes: [],
    comments: [],
    loadErrors: [],
    selectedTemplate: 'opus-narrative-deck@1',
    selectedTaxonomy: ['hierarchy-driven-hero'],
  };
}

describe('StatusCards dashboard', () => {
  it('shows trigger/transition distribution, templates, palette and per-scene edges', () => {
    render(
      <LanguageProvider>
        <StatusCards {...props()} />
      </LanguageProvider>,
    );
    const seqCard = screen.getByTestId('storyboard-seq-card').textContent ?? '';
    expect(seqCard).toContain('key:ArrowRight');
    expect(seqCard).toContain('crossfade');
    expect(seqCard).toContain('opus-narrative-deck@1');
    expect(seqCard).toContain('hierarchy-driven-hero');

    const scenesCard = screen.getByTestId('storyboard-scenes-card').textContent ?? '';
    expect(scenesCard).toContain('1. ');
    expect(scenesCard).toContain('Alpha');
    expect(scenesCard).toContain('→ crossfade · key:ArrowRight');

    const palette = screen.getByTestId('storyboard-palette').textContent ?? '';
    expect(palette).toContain('primary');
    expect(palette).toContain('#2563EB');
  });
});
