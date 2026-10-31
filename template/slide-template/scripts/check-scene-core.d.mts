export const MIN_END_CARD_HOLD_SECONDS: number;
export interface Finding {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  file?: string;
  line?: number;
}
export function checkScene(input: { scene: Record<string, unknown>; files: Record<string, string> }): Finding[];
export function renderSelfCheck(sceneName: string, findings: Finding[]): string;
