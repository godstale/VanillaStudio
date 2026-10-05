// Host side of the Vanilla Bridge (Technical-Design section 5, D-021). The preview runtime posts these
// messages; the host treats every field as untrusted input and validates it before use.
import { z } from 'zod';

export const BRIDGE_VERSION = 2;

const paramBase = { label: z.string().optional() };
export const paramDefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('color'), default: z.string(), token: z.string().optional(), ...paramBase }),
  z.object({
    kind: z.literal('number'),
    default: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    ...paramBase,
  }),
  z.object({ kind: z.literal('text'), default: z.string(), ...paramBase }),
  z.object({ kind: z.literal('boolean'), default: z.boolean(), ...paramBase }),
  z.object({ kind: z.literal('select'), options: z.array(z.string()), default: z.string(), ...paramBase }),
]);
export type ParamDef = z.infer<typeof paramDefSchema>;
export type ParamSchema = Record<string, ParamDef>;

export const sceneMetaSchema = z.object({
  id: z.string(),
  duration: z.number().positive().optional(),
  params: z.record(z.string(), paramDefSchema).default({}),
});
export type SceneMeta = z.infer<typeof sceneMetaSchema>;

const readySchema = z.object({
  scenes: z.array(sceneMetaSchema),
  duration: z.number().nonnegative().optional(),
  format: z.string(),
  design: z.object({ hash: z.string(), roles: z.record(z.string(), z.string()) }),
});
export type ReadyInfo = z.infer<typeof readySchema>;

const timeSchema = z.object({ t: z.number().finite(), sceneId: z.string().nullable() });
export type TimeInfo = z.infer<typeof timeSchema>;

const errorSchema = z.object({ message: z.string(), stack: z.string().default(''), sceneId: z.string().nullable() });
export type SceneError = z.infer<typeof errorSchema>;

const hmrSchema = z.object({ modules: z.array(z.string()), at: z.number().finite() });
export type HmrReport = z.infer<typeof hmrSchema>;

const capturedSchema = z.object({
  dataUrl: z.string().regex(/^data:image\/png;base64,/),
  scale: z.number(),
  id: z.string().optional(),
});
export type CapturedInfo = z.infer<typeof capturedSchema>;

// v2 (static pages, D-032): step progress, finish and branch choices reported by the page.
const stepSchema = z.object({ index: z.number().int().min(0), total: z.number().int().min(1) });
export type StepInfo = z.infer<typeof stepSchema>;
const doneSchema = z.object({}).passthrough();
const choiceSchema = z.object({ label: z.string().min(1).max(200) });
export type ChoiceInfo = z.infer<typeof choiceSchema>;

const envelope = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.object({ v: z.literal(BRIDGE_VERSION), type: z.literal(type), payload });

const sceneMessageSchema = z.discriminatedUnion('type', [
  envelope('ready', readySchema),
  envelope('time', timeSchema),
  envelope('error', errorSchema),
  envelope('hmr', hmrSchema),
  envelope('captured', capturedSchema),
  envelope('step', stepSchema),
  envelope('done', doneSchema),
  envelope('choice', choiceSchema),
]);
export type SceneMessage = z.infer<typeof sceneMessageSchema>;

/** `null` for anything that is not a well-formed scene message. */
export function parseSceneMessage(data: unknown): SceneMessage | null {
  const r = sceneMessageSchema.safeParse(data);
  return r.success ? r.data : null;
}

export type HostMessage =
  | {
      type: 'init';
      payload: { mode: 'preview'; paramsValues: Record<string, Record<string, unknown>>; canvas?: { width: number; height: number; fps: number } };
    }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; payload: { t: number } }
  | { type: 'setParams'; payload: { sceneId: string; values: Record<string, unknown> } }
  | { type: 'goto'; payload: { sceneId: string } }
  | { type: 'setDesign'; payload: { colors: Record<string, string> | null } }
  | { type: 'capture'; payload: { scale: number; id?: string } }
  | { type: 'reload' };

export const withVersion = (msg: HostMessage): { v: number } & HostMessage => ({ v: BRIDGE_VERSION, ...msg });

/**
 * The only messages the host accepts: sent by the iframe window we created, from the preview origin.
 * `frame` is `iframe.contentWindow`; the origin is fixed by the host, never read from a message.
 */
export function isTrustedSource(
  event: { origin: string; source: unknown },
  previewOrigin: string | null,
  frame: unknown,
): boolean {
  return previewOrigin !== null && frame !== null && frame !== undefined && event.origin === previewOrigin && event.source === frame;
}

/** Preview origin from the server URL. Only loopback http on an explicit port is accepted. */
export function previewOriginOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.port !== '' ? u.origin : null;
  } catch {
    return null;
  }
}

/** URL loaded into the iframe. `?host=` turns the runtime Bridge on and fixes the origin it talks to. */
export function previewFrameUrl(serverUrl: string, hostOrigin: string): string {
  const u = new URL(serverUrl);
  u.pathname = '/';
  u.search = '';
  u.searchParams.set('host', hostOrigin);
  return u.toString();
}
