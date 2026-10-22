export function isAscii(value: string): boolean;
export function aliasNameFor(cwd: string): string;
export function pickAsciiBase(bases: string[]): string | null;
export function ensureAsciiAlias(cwd: string): string | null;
export function needsVite(cmd: string, rest: string[]): boolean;
