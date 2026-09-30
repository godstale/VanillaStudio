import type { ToolCallFields, ToolCallStatus, ToolKind } from '@/lib/agents/types';

export function toolKindKey(kind: ToolKind | undefined): string {
  return `agentPanel.tool.kind.${kind ?? 'other'}`;
}

export function toolStatusKey(status: ToolCallStatus | undefined): string {
  return `agentPanel.tool.status.${status ?? 'pending'}`;
}

/** Raw input keys that usually hold the full shell command (Claude Code `Bash`, etc.). */
const COMMAND_KEYS = ['command', 'cmd', 'script', 'code', 'text'];

const MAX_COMMAND_CHARS = 2000;

function truncate(value: string): string {
  return value.length > MAX_COMMAND_CHARS ? `${value.slice(0, MAX_COMMAND_CHARS)}…` : value;
}

/**
 * Best-effort full text of what the agent wants to run. Returns null when the
 * input carries no readable command (the dialog then falls back to paths/title).
 */
export function extractCommand(rawInput: unknown): string | null {
  if (typeof rawInput === 'string') {
    const text = rawInput.trim();
    return text ? truncate(text) : null;
  }
  if (typeof rawInput !== 'object' || rawInput === null) return null;
  const record = rawInput as Record<string, unknown>;
  for (const key of COMMAND_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return truncate(value.trim());
  }
  const strings = Object.values(record).filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  if (strings.length === 1 && record) return truncate(strings[0].trim());
  try {
    const json = JSON.stringify(rawInput);
    return json && json !== '{}' ? truncate(json) : null;
  } catch {
    return null;
  }
}

/** First file path worth showing: an explicit location, else a diff target. */
export function primaryLocation(tool: ToolCallFields): string | null {
  const first = tool.locations?.[0];
  if (first && typeof first.path === 'string' && first.path) return first.path;
  for (const item of tool.content ?? []) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as { type?: unknown; path?: unknown };
    if (record.type === 'diff' && typeof record.path === 'string' && record.path) {
      return record.path;
    }
  }
  return null;
}
