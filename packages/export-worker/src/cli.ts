// `vanilla-export.mjs` entry (T5.1): Technical-Design §6.
//
//   `node vanilla-export.mjs <job.json>`   run one export job (NDJSON on stdout)
//   `node vanilla-export.mjs design-lint <DESIGN.md>`   lint passthrough (T3.7)
//
// Exit codes: 0 done, 2 cancelled, 1 failed. Progress goes to stdout as
// NDJSON; human-readable diagnostics go to stderr (stdout must stay parseable).
import { readFileSync } from 'node:fs';
import { designLint } from './designLint';
import { formatEvent, parseJob, type ExportJob } from './job';
import { runExport, type Steps } from './run';
import { exportImageShots } from './image';
import { exportEditableSlides } from './slidesEditable';
import { exportSlides } from './slides';
import { exportVideo } from './video';
import { exportWeb } from './web';

const STEPS: Steps = {
  web: exportWeb,
  image: exportImageShots,
  // Editable PPTX (Beta, T5.7) runs after the image outputs when requested.
  slides: async (job, ctx) => {
    const files = await exportSlides(job, ctx);
    if (job.editable) files.push(...(await exportEditableSlides(job, ctx)));
    return files;
  },
  video: exportVideo,
};

export interface CliDeps {
  readJobFile?: (path: string) => string;
  steps?: Steps;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

/** Run the CLI. Returns the process exit code (the real entry calls `process.exit`). */
export async function main(argv: readonly string[], deps: CliDeps = {}): Promise<number> {
  const readJobFile = deps.readJobFile ?? ((p: string) => readFileSync(p, 'utf8'));
  const emit = deps.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = deps.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const [cmd, arg] = argv;
  if (cmd === 'design-lint' && arg) {
    const r = await designLint(arg);
    emit(JSON.stringify(r));
    return r.status === 'ok' && r.passed ? 0 : 1;
  }
  if (!cmd || cmd === '--help' || cmd === '-h') {
    err('usage: vanilla-export.mjs <job.json> | design-lint <DESIGN.md>');
    return cmd ? 0 : 1;
  }
  let job: ExportJob;
  try {
    job = parseJob(readJobFile(cmd));
  } catch (e) {
    emit(JSON.stringify({ type: 'error', message: (e as Error).message }));
    return 1;
  }
  const ac = new AbortController();
  const onSig = (): void => ac.abort();
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);
  try {
    await runExport(job, deps.steps ?? STEPS, (e) => emit(formatEvent(e)), ac.signal);
    return 0;
  } catch (e) {
    if ((e as Error).name === 'CancelledError') {
      emit(JSON.stringify({ type: 'error', message: 'export job: cancelled' }));
      return 2;
    }
    emit(JSON.stringify({ type: 'error', message: (e as Error).message }));
    return 1;
  } finally {
    process.removeListener('SIGINT', onSig);
    process.removeListener('SIGTERM', onSig);
  }
}
