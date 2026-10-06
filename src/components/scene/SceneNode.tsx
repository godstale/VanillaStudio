import { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Box, Clapperboard, FolderOpen, LayoutTemplate, Play, Terminal, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { SceneStatus, SceneType } from '@/lib/scene/schema';

export interface SceneNodeData extends Record<string, unknown> {
  slug: string;
  name: string;
  type: SceneType;
  status: SceneStatus;
  /** motion·3d 길이(초). static은 없다. */
  duration?: number;
  referenceCount: number;
  /** `.vanilla/thumb.png`의 data URL. 아직 없으면 자리 표시. */
  thumbnail?: string;
  /** scene.json이 없거나 검증에 실패했을 때의 이유. */
  error?: string;
  onOpenFolder?: (slug: string) => void;
  /** 에이전트 실행(터미널 도크). 없으면 버튼이 꺼진다. */
  onRunAgent?: (slug: string) => void;
  /** 미리보기 열기(인스펙터 미리보기 탭). 없으면 버튼이 꺼진다. */
  onPlay?: (slug: string) => void;
}

export type SceneFlowNode = Node<SceneNodeData, 'scene'>;

const TYPE_ICON: Record<SceneType, LucideIcon> = { static: LayoutTemplate, motion: Clapperboard, '3d': Box };

const STATUS_CLASS: Record<SceneStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  'prompt-ready': 'bg-primary/15 text-primary',
  generated: 'bg-success/15 text-success',
  'needs-revision': 'bg-warning/15 text-warning',
};

// 에이전트 실행·재생 버튼은 V4(터미널·재생)에서 연결한다. 지금은 자리만 둔다.
function SceneNodeView({ data, selected }: NodeProps<SceneFlowNode>) {
  const { t } = useLanguage();
  const Icon = TYPE_ICON[data.type];
  return (
    <div
      data-testid="scene-node"
      className={cn(
        'w-60 rounded-lg border bg-card p-2 text-xs text-card-foreground shadow-sm',
        selected ? 'border-primary' : 'border-border',
        data.error && 'border-destructive',
      )}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={t(`scene.type.${data.type}`)} />
        <b className="min-w-0 flex-1 truncate text-sm">{data.name}</b>
        <span className={cn('rounded px-1.5 py-0.5 text-[10px]', STATUS_CLASS[data.status])}>{t(`scene.status.${data.status}`)}</span>
      </div>
      {data.error ? (
        <div role="alert" className="mb-2 flex items-start gap-1 rounded bg-destructive/10 p-2 text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{t('scene.invalid')}</span>
        </div>
      ) : (
        <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
          {data.thumbnail ? <img src={data.thumbnail} alt={t('scene.thumbnailAlt', { name: data.name })} className="h-full w-full object-contain" /> : t('scene.noThumbnail')}
        </div>
      )}
      <div className="mb-2 flex justify-between text-muted-foreground">
        <span>{data.duration !== undefined ? `${data.duration}s` : t('scene.type.static')}</span>
        <span>{t('scene.references', { count: data.referenceCount })}</span>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!data.onRunAgent || Boolean(data.error)}
          onClick={() => data.onRunAgent?.(data.slug)}
          className="nodrag flex flex-1 items-center justify-center gap-1 rounded border border-border px-1 py-1 hover:bg-accent disabled:opacity-50"
        >
          <Terminal className="h-3 w-3" />
          {t('scene.runAgent')}
        </button>
        <button
          type="button"
          disabled={!data.onPlay || Boolean(data.error)}
          onClick={() => data.onPlay?.(data.slug)}
          className="nodrag flex flex-1 items-center justify-center gap-1 rounded border border-border px-1 py-1 hover:bg-accent disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          {t('scene.play')}
        </button>
        <button
          type="button"
          onClick={() => data.onOpenFolder?.(data.slug)}
          aria-label={t('scene.openFolder')}
          title={t('scene.openFolder')}
          className="nodrag flex items-center justify-center rounded border border-border px-2 py-1 hover:bg-accent"
        >
          <FolderOpen className="h-3 w-3" />
        </button>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const SceneNode = memo(SceneNodeView);
