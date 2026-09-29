import { agentErrorKey, parseAgentError } from '@/lib/agents/types';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Map a raw host/context error to a user-facing string (i18n key first, raw data last). */
export function describeSessionError(t: Translate, message: string | null): string | null {
  if (!message) return null;
  if (message === 'no-project') return t('agentPanel.noProject');
  if (message === 'untrusted' || message === 'not-trusted') return t('agentPanel.untrusted');
  if (message === 'terminal-mode' || message === 'no-agent') return t('agentPanel.terminalMode');
  const { code, detail } = parseAgentError(message);
  if (code !== 'unknown') {
    return detail ? `${t(agentErrorKey(code))}: ${detail}` : t(agentErrorKey(code));
  }
  return message;
}
