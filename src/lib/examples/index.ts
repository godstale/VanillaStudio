import { z } from 'zod';

// 예제 라이브러리(D-047): resources/examples/<kind>/<id>/ 폴더를 넣으면 등록 없이 카드에 나타난다.
// 카드에는 도구가 캡처한 preview.webp만 쓴다. example.html은 앱 CSP에서 실행하지 않고 소스 보기로만 연다.

export const EXAMPLE_KINDS = ['style', 'template', 'guide', 'preset', 'recipe', 'technique', 'palette'] as const;
export type ExampleKind = (typeof EXAMPLE_KINDS)[number];

const FILMSTRIP_FRAMES = 8;

const metaSchema = z
  .object({
    seconds: z.number().min(0).max(12),
    note: z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict(),
  })
  .strict();

export interface Example {
  previewUrl: string;
  frames: number;
  note: { ko: string; en: string };
  loadSource: () => Promise<string>;
}

const metas = import.meta.glob('../../../resources/examples/*/*/example.json', { eager: true, import: 'default' });
const previews = import.meta.glob<string>('../../../resources/examples/*/*/preview.webp', { eager: true, query: '?url', import: 'default' });
const sources = import.meta.glob<string>('../../../resources/examples/*/*/example.html', { query: '?raw', import: 'default' });

const examples = new Map<string, Example>();
for (const [path, raw] of Object.entries(metas)) {
  const dir = path.replace(/\/example\.json$/, '');
  const previewUrl = previews[`${dir}/preview.webp`];
  const loadSource = sources[`${dir}/example.html`];
  const key = dir.split('/').slice(-2).join('/');
  if (!previewUrl || !loadSource) continue;
  const meta = metaSchema.parse(raw);
  examples.set(key, { previewUrl, frames: meta.seconds > 0 ? FILMSTRIP_FRAMES : 1, note: meta.note, loadSource });
}

export const getExample = (kind: ExampleKind, id: string): Example | undefined => examples.get(`${kind}/${id}`);

export const exampleKeys = (): string[] => [...examples.keys()];
