import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Templates } from './Templates';

describe('Templates', () => {
  it('shows guide templates per scene type and the palette library', () => {
    render(
      <LanguageProvider>
        <Templates />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('templates-page')).toBeTruthy();
    // 내장 가이드 3종(타입별 1개)과 팔레트 24종.
    expect(screen.getAllByText(/commercial|web-page|three-scene/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Paper Dawn')).toBeTruthy();
    expect(screen.getByText(/예제 이미지|Example images/)).toBeTruthy();
  });
});
