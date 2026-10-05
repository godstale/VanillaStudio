import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { defaultTemplateFor } from '@/lib/guides/template';
import { newScene, sceneSchema, type Scene, type SceneType } from '@/lib/scene/schema';
import { SceneForm } from './SceneForm';

function Harness({ type, initial, onScene }: { type: SceneType; initial?: Scene; onScene?: (s: Scene) => void }) {
  const template = defaultTemplateFor(type);
  const [scene, setScene] = useState<Scene>(initial ?? newScene({ id: 'scn_A', name: 'A', type, template: template.ref }));
  return (
    <LanguageProvider>
      <SceneForm
        scene={scene}
        template={template}
        onChange={(s) => {
          setScene(s);
          onScene?.(s);
        }}
      />
    </LanguageProvider>
  );
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0] as Scene;
const label = (re: RegExp) => screen.getByLabelText(re);

describe('SceneForm (motion)', () => {
  it('edits every kind of field and keeps the scene valid', () => {
    const onScene = vi.fn();
    render(<Harness type="motion" onScene={onScene} />);

    fireEvent.change(label(/길이\(초\)|Duration \(s\)/), { target: { value: '12' } });
    expect((last(onScene) as { duration: { seconds: number } }).duration.seconds).toBe(12);

    fireEvent.change(label(/^영상 구조$|^Structure$/), { target: { value: 'continuous' } });
    expect((last(onScene) as { structure: string }).structure).toBe('continuous');

    const mood = label(/^분위기$|^Mood$/);
    fireEvent.change(mood, { target: { value: 'warm and confident' } });
    expect((last(onScene) as { visualStyle: { mood: string } }).visualStyle.mood).toBe('warm and confident');

    const voice = screen.getByRole('combobox', { name: /^브랜드 보이스$|^Brand voice$/ });
    fireEvent.change(voice, { target: { value: 'bold' } });
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getAllByRole('option')[0]);
    expect((last(onScene) as { brandVoice: string[] }).brandVoice).toEqual(['bold']);

    const copy = label(/화면 문구 원문 목록|On-screen copy items/);
    fireEvent.change(copy, { target: { value: '오늘, 챙겼어?' } });
    fireEvent.keyDown(copy, { key: 'Enter' });
    expect((last(onScene) as { copy: { items: string[] } }).copy.items).toEqual(['오늘, 챙겼어?']);

    fireEvent.click(label(/지정하지 않은 요소 추가 금지|Add nothing unspecified/));
    expect((last(onScene) as { constraints: { noUnspecifiedElements: boolean } }).constraints.noUnspecifiedElements).toBe(false);

    expect(sceneSchema.safeParse(last(onScene)).success).toBe(true);
  });

  it('audio fields turn empty text into null', () => {
    const onScene = vi.fn();
    render(<Harness type="motion" onScene={onScene} />);
    const vo = label(/^나레이션$|^Voice-over$/);
    fireEvent.change(vo, { target: { value: 'warm voice' } });
    expect((last(onScene) as { audio: { voiceOver: string | null } }).audio.voiceOver).toBe('warm voice');
    fireEvent.change(vo, { target: { value: '' } });
    expect((last(onScene) as { audio: { voiceOver: string | null } }).audio.voiceOver).toBeNull();
  });

  it('shows all motion sections', () => {
    render(<Harness type="motion" />);
    for (const re of [/구조|Structure/, /시간 구조|Timing/, /엔드카드|End card/, /오디오|Audio/, /제약|Constraints/]) {
      expect(screen.getAllByText(re).length).toBeGreaterThan(0);
    }
  });
});

describe('beats editor in the form', () => {
  it('adds beats, distributes the duration and flags a bad total', () => {
    const onScene = vi.fn();
    render(<Harness type="motion" onScene={onScene} />);
    const editor = () => screen.getByTestId('beats-editor');
    fireEvent.click(within(editor()).getByRole('button', { name: /Beat 추가|Add beat/ }));
    fireEvent.click(within(editor()).getByRole('button', { name: /Beat 추가|Add beat/ }));
    expect((last(onScene) as { beats: unknown[] }).beats).toHaveLength(2);
    expect(within(editor()).getByRole('status').textContent).toMatch(/4/); // 2 + 2 seconds of a 10 second scene
    fireEvent.click(within(editor()).getByRole('button', { name: /균등 분할|Distribute evenly/ }));
    const beats = (last(onScene) as { beats: { start: number; end: number }[] }).beats;
    expect(beats.map((b) => [b.start, b.end])).toEqual([[0, 5], [5, 10]]);
    expect(sceneSchema.safeParse(last(onScene)).success).toBe(true);
    expect(within(editor()).getByRole('status').textContent).toMatch(/시간 구조가 길이와 맞습니다|Timing matches/);
  });

  it('edits times and shows the validation problem; reorders and removes', () => {
    const onScene = vi.fn();
    render(<Harness type="motion" onScene={onScene} />);
    const editor = () => screen.getByTestId('beats-editor');
    fireEvent.click(within(editor()).getByRole('button', { name: /Beat 추가|Add beat/ }));
    const [start, end] = within(editor()).getAllByRole('spinbutton');
    fireEvent.change(end, { target: { value: '9' } });
    expect((start as HTMLInputElement).value).toBe('0');
    expect(within(editor()).getByRole('status').textContent).toMatch(/duration|길이/);
    fireEvent.click(within(editor()).getByRole('button', { name: /Beat 추가|Add beat/ }));
    fireEvent.click(within(editor()).getAllByRole('button', { name: /아래로|Move down/ })[0]);
    expect((last(onScene) as { beats: { id: string }[] }).beats.map((b) => b.id)).toEqual(['b2', 'b1']);
    fireEvent.click(within(editor()).getByRole('button', { name: /삭제 b2|Remove b2/ }));
    expect((last(onScene) as { beats: { id: string }[] }).beats.map((b) => b.id)).toEqual(['b1']);
  });
});

describe('SceneForm (static)', () => {
  it('shows the steps section only in steps mode and edits advance inputs', () => {
    const onScene = vi.fn();
    render(<Harness type="static" onScene={onScene} />);
    expect(screen.queryByTestId('steps-editor')).toBeNull();
    fireEvent.change(label(/^모드$|^Mode$/), { target: { value: 'steps' } });
    const editor = () => screen.getByTestId('steps-editor');
    fireEvent.click(within(editor()).getByRole('button', { name: /스텝 추가|Add step/ }));
    expect((last(onScene) as { steps: { advance: string }[] }).steps[0].advance).toBe('click');

    const kind = within(editor()).getByRole('combobox', { name: /s1 진행 입력|s1 Advance input/ }) as HTMLSelectElement;
    fireEvent.change(kind, { target: { value: 'key' } });
    expect((last(onScene) as { steps: { advance: string }[] }).steps[0].advance).toBe('key:ArrowRight');
    fireEvent.change(within(editor()).getByLabelText(/키 이름|Key name/), { target: { value: 'Space' } });
    expect((last(onScene) as { steps: { advance: string }[] }).steps[0].advance).toBe('key:Space');
    fireEvent.change(kind, { target: { value: 'choice' } });
    expect(within(editor()).getByRole('alert')).toBeTruthy(); // empty choice label
    fireEvent.change(within(editor()).getByLabelText(/선택지 이름|Choice label/), { target: { value: 'Yes' } });
    expect((last(onScene) as { steps: { advance: string }[] }).steps[0].advance).toBe('choice:Yes');
    expect(sceneSchema.safeParse(last(onScene)).success).toBe(true);
  });

  it('never offers timer or auto advance', () => {
    render(<Harness type="static" initial={{ ...newScene({ id: 'scn_A', name: 'A', type: 'static', template: 'web-page@1' }), mode: 'steps', steps: [{ id: 's1', title: '', copy: '', layout: '', enter: 'fade', advance: 'click' }] } as Scene} />);
    const options = within(screen.getByTestId('steps-editor')).getAllByRole('option').map((o) => o.getAttribute('value'));
    expect(options).toEqual(['click', 'key', 'choice']);
  });
});

describe('SceneForm (3d)', () => {
  it('adds the 3d section with its glossary-backed fields', () => {
    const onScene = vi.fn();
    render(<Harness type="3d" onScene={onScene} />);
    expect(screen.getAllByText(/3D 씬|3D scene/).length).toBeGreaterThan(0);
    const lighting = screen.getByRole('combobox', { name: /^조명$|^Lighting$/ });
    fireEvent.change(lighting, { target: { value: 'three' } });
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getAllByRole('option')[0]);
    expect((last(onScene) as { lighting: string }).lighting).toBe('three-point');
  });
});
