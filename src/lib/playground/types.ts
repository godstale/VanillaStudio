// Playground item model (T6.8, F-PLY-01).
//
// The playground index is app state, so it lives in the global DB
// (`playground_items` + `playground_meta`, Technical-Design §8.1) — not in
// files. `dirPath` references the export output folder; no byte copy happens
// (a Rust copy command outside the workspace scope does not exist yet, so the
// API layer stores a reference and the player reads through it).
import { z } from 'zod';

export const PLAYGROUND_KINDS = ['web', 'interactive', 'image', 'slides', 'video'] as const;

export type PlaygroundKind = (typeof PLAYGROUND_KINDS)[number];

export function isPlaygroundKind(value: string): value is PlaygroundKind {
  return (PLAYGROUND_KINDS as readonly string[]).includes(value);
}

export interface PlaygroundItem {
  id: string;
  title: string;
  kind: PlaygroundKind;
  /** Absolute path of the export output folder this item plays. */
  dirPath: string;
  /** Project root the export ran in (workspace scope for file reads). */
  sourceProject: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

const slugId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'item id');

export const playgroundItemSchema = z.object({
  id: slugId,
  title: z.string().trim().min(1).max(120),
  kind: z.enum(PLAYGROUND_KINDS),
  dirPath: z.string().min(1),
  sourceProject: z.string().min(1).nullable(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type PlaygroundItemInput = z.infer<typeof playgroundItemSchema>;

export function parsePlaygroundItem(raw: unknown): PlaygroundItemInput {
  return playgroundItemSchema.parse(raw);
}

/** `pg-<epoch>-<rand>`: unique without a DB round-trip. */
export function makePlaygroundId(now: number = Date.now(), rand: number = Math.random()): string {
  return `pg-${Math.floor(now)}-${Math.floor(rand * 1e6)}`;
}

const MAX_TAGS = 12;

/** Trim, drop empties, dedupe case-insensitively (first spelling wins). */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}
