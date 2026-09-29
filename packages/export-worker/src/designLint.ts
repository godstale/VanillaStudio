// DESIGN.md lint through the official CLI (`@google/design.md`, pinned; Apache-2.0). Technical-Design §2.3, §6.
//
// The CLI is an optional second opinion (D-017, Feasibility-Risks §2.10): the app's own zod parser
// (`src/lib/design`) is the primary check. A missing or broken CLI therefore returns a result instead of
// throwing, and the caller falls back to its own validation.
//
// Rules (S6, S7): fixed argv, no shell; stdin closed (the CLI waits for input otherwise and hangs);
// hard timeout; no telemetry or API keys in the environment; `orphaned-tokens` findings are dropped
// because scene code, not DESIGN.md components, is what uses the color roles.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** Pinned in package.json. Bump it deliberately: the JSON shape below is what this version prints. */
export const DESIGN_MD_CLI_VERSION = '0.4.0';

/** Findings that do not apply to Vanilla projects. */
export const IGNORED_RULES: readonly string[] = ['orphaned-tokens'];

const findingSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  path: z.string().optional(),
  rule: z.string().optional(),
});
const outputSchema = z.object({ findings: z.array(findingSchema) }).passthrough();

export type LintFinding = z.infer<typeof findingSchema>;

export interface LintSummary {
  errors: number;
  warnings: number;
  infos: number;
}

export type DesignLintResult =
  | {
      status: 'ok';
      /** No error-level findings (warnings and infos do not fail a DESIGN.md). */
      passed: boolean;
      cliVersion: string;
      findings: LintFinding[];
      summary: LintSummary;
      /** Findings dropped by `IGNORED_RULES`. */
      filtered: number;
    }
  | {
      /** CLI missing, crashed, timed out or printed something unexpected. Fall back to the app's own check. */
      status: 'unavailable';
      reason: string;
    };

export interface DesignLintOptions {
  /** CLI entry script. Default: the pinned package resolved from this module. */
  cliPath?: string;
  /** Node executable. Default: the current one. */
  node?: string;
  timeoutMs?: number;
  /** Environment for the child (default: `process.env` minus API keys). */
  env?: NodeJS.ProcessEnv;
}

interface CliPackage {
  entry: string;
  version: string;
}

function resolveCli(cliPath?: string): CliPackage {
  if (cliPath) return { entry: cliPath, version: 'custom' };
  // The package's `exports` hides package.json; its main entry is the CLI script, and package.json sits one level up.
  const entry = fileURLToPath(import.meta.resolve('@google/design.md'));
  const pkg = JSON.parse(readFileSync(path.join(path.dirname(entry), '..', 'package.json'), 'utf8')) as { version: string };
  return { entry, version: pkg.version };
}

/** Never hand secrets to a tool that has no reason to see them (the HyperFrames CLI reads GEMINI_API_KEY, S1). */
function cleanEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, DO_NOT_TRACK: '1' };
  for (const key of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY']) delete env[key];
  return env;
}

function run(node: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    // stdin is closed ('ignore'): an open stdin makes the CLI wait for input forever (S7).
    const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'], env, windowsHide: true, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

export const summarize = (findings: readonly LintFinding[]): LintSummary => ({
  errors: findings.filter((f) => f.severity === 'error').length,
  warnings: findings.filter((f) => f.severity === 'warning').length,
  infos: findings.filter((f) => f.severity === 'info').length,
});

/** Lint a DESIGN.md file (absolute path). Never throws. */
export async function designLint(file: string, options: DesignLintOptions = {}): Promise<DesignLintResult> {
  if (!path.isAbsolute(file)) return { status: 'unavailable', reason: 'designLint: file must be an absolute path' };
  let cli: CliPackage;
  try {
    cli = resolveCli(options.cliPath);
  } catch (e) {
    return { status: 'unavailable', reason: `design.md CLI not found: ${(e as Error).message}` };
  }
  let out: Awaited<ReturnType<typeof run>>;
  try {
    out = await run(options.node ?? process.execPath, [cli.entry, 'lint', '--format', 'json', file], cleanEnv(options.env ?? process.env), options.timeoutMs ?? 20_000);
  } catch (e) {
    return { status: 'unavailable', reason: `design.md CLI failed to run: ${(e as Error).message}` };
  }
  // Exit 1 means "errors found" and still prints the report; anything else without JSON is a failure (2: bad input).
  let parsed: z.infer<typeof outputSchema>;
  try {
    parsed = outputSchema.parse(JSON.parse(out.stdout));
  } catch {
    const detail = (out.stderr || out.stdout).trim().split('\n')[0] ?? '';
    return { status: 'unavailable', reason: `design.md CLI gave no usable report (exit ${out.code}): ${detail.slice(0, 200)}` };
  }
  const findings = parsed.findings.filter((f) => !(f.rule && IGNORED_RULES.includes(f.rule)));
  const summary = summarize(findings);
  return {
    status: 'ok',
    passed: summary.errors === 0,
    cliVersion: cli.version,
    findings,
    summary,
    filtered: parsed.findings.length - findings.length,
  };
}
