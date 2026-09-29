import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PendingPermission } from '@/lib/agents/session';
import { firstPending } from '@/lib/agents/session';
import { useAgentSession } from '@/lib/agents/sessionContextValue';
import {
  extractCommand,
  primaryLocation,
  toolKindKey,
} from '@/components/agents/toolCallMeta';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface PermissionDialogViewProps {
  sessionId: string;
  request: PendingPermission;
  busy: boolean;
  onAllow: (optionId: string) => void;
  onDeny: (optionId: string) => void;
  onDismiss: () => void;
}

// Pure view (tested without a backend): full shell command text, affected
// path, and only allow-once / deny (D-010: allow_always is never offered).
export function PermissionDialogView({
  request,
  busy,
  onAllow,
  onDeny,
  onDismiss,
}: PermissionDialogViewProps) {
  const { t } = useLanguage();
  const allow = request.options.find((o) => o.kind === 'allow_once') ?? null;
  const deny = request.options.find((o) => o.kind === 'reject_once') ?? null;
  const command = extractCommand(request.tool.rawInput);
  const path = primaryLocation(request.tool);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DialogContent data-testid="permission-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-destructive" aria-hidden />
            {t('agentPanel.permission.title')}
          </DialogTitle>
          <DialogDescription>
            <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t(toolKindKey(request.tool.kind))}
            </span>
            {request.title || request.toolCallId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            {t('agentPanel.permission.reason')}: {request.reason}
          </p>
          {command && (
            <div>
              <div className="pb-1 font-medium">{t('agentPanel.permission.command')}</div>
              <pre
                data-testid="permission-command"
                className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/50 p-2 font-mono text-[11px]"
              >
                {command}
              </pre>
            </div>
          )}
          {path && (
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {t('agentPanel.permission.path')}: {path}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            data-testid="permission-dismiss"
            onClick={onDismiss}
          >
            {t('agentPanel.permission.dismiss')}
          </Button>
          {deny && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              data-testid="permission-deny"
              onClick={() => onDeny(deny.optionId)}
            >
              {t('agentPanel.permission.rejectOnce')}
            </Button>
          )}
          {allow && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              data-testid="permission-allow"
              onClick={() => onAllow(allow.optionId)}
            >
              {t('agentPanel.permission.allowOnce')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Connected dialog: shows the first pending request of the store and answers
// it through the host (optionId null dismisses, the agent sees `cancelled`).
export function PermissionDialog() {
  const { store, respondPermission } = useAgentSession();
  const [busy, setBusy] = useState(false);
  const pending = firstPending(store);
  if (!pending) return null;

  const answer = async (optionId: string | null) => {
    setBusy(true);
    try {
      await respondPermission(pending.sessionId, pending.request.requestId, optionId);
    } catch {
      // The failure surfaces in the panel error banner; the request stays queued.
    } finally {
      setBusy(false);
    }
  };

  return (
    <PermissionDialogView
      sessionId={pending.sessionId}
      request={pending.request}
      busy={busy}
      onAllow={(optionId) => void answer(optionId)}
      onDeny={(optionId) => void answer(optionId)}
      onDismiss={() => void answer(null)}
    />
  );
}

export default PermissionDialog;
