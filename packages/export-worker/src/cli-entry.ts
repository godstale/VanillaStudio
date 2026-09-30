// Bundle entry for `resources/workers/vanilla-export.mjs` (W1 fix).
//
// The only module with a top-level side effect (arg parsing + process exit).
// Unit tests import `main` from `./cli` instead so they never exit the test
// runner. The Rust backend spawns exactly
// `node <app>/workers/vanilla-export.mjs <job.json>` (export_commands.rs).
import { main } from './cli';

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`export worker: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  },
);
