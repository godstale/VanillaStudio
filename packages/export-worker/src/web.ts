// Placeholder re-exported by cli.ts until T5.3 lands.

export function exportWeb(): Promise<string[]> {
  return Promise.reject(new Error('export worker: web step not implemented (T5.3)'));
}
