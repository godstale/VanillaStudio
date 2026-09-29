// Placeholder re-exported by cli.ts until T5.5 lands.

export function exportImageShots(): Promise<string[]> {
  return Promise.reject(new Error('export worker: image step not implemented (T5.5)'));
}
