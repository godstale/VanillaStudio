import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import type { SeqEdge } from '@/lib/sequence/edit';
import { EdgeSection, type EdgeSectionProps } from './EdgeSection';

const edge = (over: Partial<SeqEdge> = {}): SeqEdge => ({
  from: 'scn_a',
  to: 'scn_b',
  trigger: 'end',
  transition: { type: 'crossfade', durationMs: 600, easing: 'ease-in-out', params: {} },
  ...over,
});

function setup(props: Partial<EdgeSectionProps> = {}) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <LanguageProvider>
      <EdgeSection edge={edge()} fromName="Intro" toName="Page" fromType="motion" customTransitions={[]} issues={[]} onChange={onChange} onDelete={onDelete} {...props} />
    </LanguageProvider>,
  );
  return { onChange, onDelete };
}

const triggerSelect = () => screen.getByLabelText(/trigger 종류|Trigger type/) as HTMLSelectElement;
const typeSelect = () => screen.getByLabelText(/전환 종류|Transition type/) as HTMLSelectElement;

describe('EdgeSection', () => {
  it('shows the connection and deletes it', () => {
    const { onDelete } = setup();
    expect(screen.getByText('Intro → Page')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /연결 삭제|Delete connection/ }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('changing the trigger kind writes a valid trigger with sensible defaults', () => {
    const { onChange } = setup();
    fireEvent.change(triggerSelect(), { target: { value: 'click' } });
    expect(onChange).toHaveBeenLastCalledWith({ trigger: 'click' });
    fireEvent.change(triggerSelect(), { target: { value: 'timeout' } });
    expect(onChange).toHaveBeenLastCalledWith({ trigger: 'timeout:3s' });
    fireEvent.change(triggerSelect(), { target: { value: 'key' } });
    expect(onChange).toHaveBeenLastCalledWith({ trigger: 'key:ArrowRight' });
    fireEvent.change(triggerSelect(), { target: { value: 'choice' } });
    expect(onChange).toHaveBeenLastCalledWith({ trigger: 'choice:Page' });
  });

  it('an invalid value is not saved and explains why', () => {
    const { onChange } = setup({ edge: edge({ trigger: 'timeout:3s' }) });
    const input = screen.getByLabelText(/^초$|^Seconds$/);
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByRole('alert').textContent).toMatch(/올바른 값|valid value/);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(onChange).toHaveBeenLastCalledWith({ trigger: 'timeout:2.5s' });
  });

  it('static scenes cannot pick automatic triggers', () => {
    setup({ fromType: 'static', edge: edge({ trigger: 'click' }) });
    const options = [...triggerSelect().options];
    expect(options.find((o) => o.value === 'end')!.disabled).toBe(true);
    expect(options.find((o) => o.value === 'timeout')!.disabled).toBe(true);
    expect(options.find((o) => o.value === 'click')!.disabled).toBe(false);
    expect(options.find((o) => o.value === 'choice')!.disabled).toBe(false);
  });

  it('changing the transition keeps timing, resets params, and offers the custom ones', () => {
    const { onChange } = setup({ customTransitions: ['iris-blur'] });
    expect([...typeSelect().options].map((o) => o.value)).toContain('custom:iris-blur');
    fireEvent.change(typeSelect(), { target: { value: 'mask-wipe' } });
    expect(onChange).toHaveBeenLastCalledWith({ transition: { type: 'mask-wipe', durationMs: 600, easing: 'ease-in-out', params: {} } });
  });

  it('shows params for the transition type and writes them', () => {
    const { onChange } = setup({ edge: edge({ transition: { type: 'mask-wipe', durationMs: 600, easing: 'ease-in-out', params: {} } }) });
    fireEvent.change(screen.getByLabelText(/와이프 방향|Wipe direction/), { target: { value: 'down' } });
    expect(onChange).toHaveBeenLastCalledWith({ transition: { type: 'mask-wipe', durationMs: 600, easing: 'ease-in-out', params: { direction: 'down' } } });
  });

  it('duration is clamped and a cut has no timing controls', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText(/길이|Duration/), { target: { value: '99999' } });
    expect(onChange).toHaveBeenLastCalledWith({ transition: expect.objectContaining({ durationMs: 5000 }) });
  });

  it('a cut hides duration and easing', () => {
    setup({ edge: edge({ transition: { type: 'cut', durationMs: 0, easing: '', params: {} } }) });
    expect(screen.queryByLabelText(/길이|Duration/)).toBeNull();
  });

  it('flags an undefined custom transition and lists validation issues', () => {
    setup({
      edge: edge({ transition: { type: 'custom:ghost', durationMs: 600, easing: 'ease-in-out', params: {} } }),
      issues: [{ code: 'static-auto-trigger', severity: 'error', message: 'Page is a static page' }],
    });
    const alerts = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alerts.some((a) => a?.includes('Page is a static page'))).toBe(true);
    expect(alerts.some((a) => a?.includes('custom:ghost'))).toBe(true);
  });
});
