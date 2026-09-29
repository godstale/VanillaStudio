// Placeholder re-exported by cli.ts until T5.8 lands.

export function exportVideo(): Promise<string[]> {
  return Promise.reject(new Error('export worker: video step not implemented (T5.8)'));
}
