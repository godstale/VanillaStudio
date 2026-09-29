// Scene parameter schema, value resolution and the useParams() context.
// Value precedence (Technical-Design §4.4): code default < design token < user value
// (`params/<sceneId>.values.json`, owned by the user).
import { createContext, createElement, useContext, type ReactNode } from 'react';

/** Reference to a DESIGN.md color role, usable as a `param.color` default. */
export interface TokenRef {
  readonly $token: string;
}

export const token = (role: string): TokenRef => ({ $token: role });

const isTokenRef = (v: unknown): v is TokenRef =>
  typeof v === 'object' && v !== null && typeof (v as { $token?: unknown }).$token === 'string';

interface Labeled {
  label?: string;
}

export interface ColorParam extends Labeled {
  kind: 'color';
  /** Literal fallback used when no token is bound or the token role is missing. */
  default: string;
  /** Design color role that overrides the literal default. */
  token?: string;
}
export interface NumberParam extends Labeled {
  kind: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
}
export interface TextParam extends Labeled {
  kind: 'text';
  default: string;
}
export interface BooleanParam extends Labeled {
  kind: 'boolean';
  default: boolean;
}
export interface SelectParam<O extends string = string> extends Labeled {
  kind: 'select';
  options: readonly O[];
  default: O;
}

export type ParamDef = ColorParam | NumberParam | TextParam | BooleanParam | SelectParam;
export type ParamSchema = Record<string, ParamDef>;

type ValueOf<D> = D extends NumberParam
  ? number
  : D extends BooleanParam
    ? boolean
    : D extends SelectParam<infer O>
      ? O
      : string;
export type ParamValues<P extends ParamSchema> = { [K in keyof P]: ValueOf<P[K]> };

export const param = {
  color(def: string | TokenRef, opts: Labeled & { fallback?: string } = {}): ColorParam {
    const { fallback = '#000000', ...rest } = opts;
    return isTokenRef(def)
      ? { kind: 'color', default: fallback, token: def.$token, ...rest }
      : { kind: 'color', default: def, ...rest };
  },
  number(def: number, opts: Labeled & { min?: number; max?: number; step?: number } = {}): NumberParam {
    return { kind: 'number', default: def, ...opts };
  },
  text(def: string, opts: Labeled = {}): TextParam {
    return { kind: 'text', default: def, ...opts };
  },
  boolean(def: boolean, opts: Labeled = {}): BooleanParam {
    return { kind: 'boolean', default: def, ...opts };
  },
  select<const O extends string>(options: readonly O[], def: NoInfer<O>, opts: Labeled = {}): SelectParam<O> {
    return { kind: 'select', options, default: def, ...opts };
  },
};

/** Accept a user-supplied raw value only if it fits the definition; otherwise `undefined`. */
export function coerceParam(def: ParamDef, raw: unknown): unknown {
  switch (def.kind) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
      const lo = def.min ?? -Infinity;
      const hi = def.max ?? Infinity;
      return Math.min(hi, Math.max(lo, raw));
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : undefined;
    case 'select':
      return typeof raw === 'string' && def.options.includes(raw) ? raw : undefined;
    case 'color':
    case 'text':
      return typeof raw === 'string' && (def.kind === 'text' || raw.trim() !== '') ? raw : undefined;
  }
}

export interface ResolveInput {
  /** Design color roles (already reference-resolved). */
  tokens?: Readonly<Record<string, string>>;
  /** Contents of the scene's `params/<id>.values.json`; unknown keys and bad types are ignored. */
  user?: Readonly<Record<string, unknown>>;
}

export function resolveParams<P extends ParamSchema>(schema: P, input: ResolveInput = {}): ParamValues<P> {
  const out: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    let value: unknown = def.default;
    if (def.kind === 'color' && def.token) {
      const fromToken = input.tokens?.[def.token];
      if (fromToken) value = fromToken;
    }
    const user = input.user && Object.hasOwn(input.user, key) ? coerceParam(def, input.user[key]) : undefined;
    out[key] = user !== undefined ? user : value;
  }
  return out as ParamValues<P>;
}

const ParamsContext = createContext<Readonly<Record<string, unknown>> | null>(null);

export function ParamsProvider({ values, children }: { values: Readonly<Record<string, unknown>>; children?: ReactNode }) {
  return createElement(ParamsContext.Provider, { value: values }, children);
}

export function useParams<P extends ParamSchema = ParamSchema>(): ParamValues<P> {
  const v = useContext(ParamsContext);
  if (!v) throw new Error('useParams() must be called inside a scene rendered by the Vanilla runtime');
  return v as ParamValues<P>;
}
