import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ToolCallBlock } from '@/lib/agents/session';
import { contentText } from '@/lib/agents/sessionReducer';
import { DiffView } from '@/components/agents/DiffView';
import {
  primaryLocation,
  toolKindKey,
  toolStatusKey,
} from '@/components/agents/toolCallMeta';
import { cn } from '@/lib/utils';

export interface ToolCallCardProps {
  block: ToolCallBlock;
}

// One ACP tool call: kind badge, title, status, and per-item content
// (text, file diff, terminal reference) plus file locations.
export function ToolCallCard({ block }: ToolCallCardProps) {
  const { t } = useLanguage();
  const failed = block.tool.status === 'failed';
  return (
    <div
      data-testid="tool-call-card"
      data-status={block.tool.status ?? 'pending'}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t(toolKindKey(block.tool.kind))}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {block.title || block.toolCallId}
        </span>
        <span
          data-testid="tool-call-status"
          className={cn(
            'shrink-0 text-[10px]',
            failed ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {t(toolStatusKey(block.tool.status))}
        </span>
      </div>
      {(block.tool.content ?? []).map((item, i) => {
        if (item.type === 'diff') {
          return (
            <div key={i} className="border-t border-border p-2">
              <DiffView path={item.path} oldText={item.oldText} newText={item.newText} />
            </div>
          );
        }
        if (item.type === 'terminal') {
          return (
            <div
              key={i}
              className="border-t border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {item.terminalId}
            </div>
          );
        }
        const text = contentText(item.content);
        if (!text) return null;
        return (
          <div
            key={i}
            className="whitespace-pre-wrap break-words border-t border-border px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            {text}
          </div>
        );
      })}
      {primaryLocation(block.tool) && (block.tool.content ?? []).length === 0 && (
        <div className="truncate border-t border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          {primaryLocation(block.tool)}
        </div>
      )}
    </div>
  );
}

export default ToolCallCard;
