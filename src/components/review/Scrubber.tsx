import { useEffect, useMemo, useState } from 'react';
import { Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBridge, useBridgeTime } from '@/lib/review/bridgeContextValue';
import { formatTime, layoutTimeline, segmentIndexAt } from '@/lib/review/timeline';
import { type TimeKind } from '@/lib/review/reviewProject';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export interface ScrubberProps {
  fps: number;
  timeKind: TimeKind;
}

/**
 * Timeline scrubber (F-REV-02). Clock types (`video`/`image`/`slides`) get play/pause, frame steps,
 * Scene jumps, a slider and section repeat; free types (`web`/`interactive`) only play/pause because
 * the Bridge ignores `seek` there and scenes run on their own loop.
 */
export function Scrubber({ fps, timeKind }: ScrubberProps) {
  const { t } = useBridgeTime();
  const bridge = useBridge();
  const { t: tr } = useLanguage();
  const free = timeKind === 'free';

  const timeline = useMemo(
    () => layoutTimeline(bridge.ready?.scenes ?? [], bridge.ready?.duration),
    [bridge.ready],
  );
  const canScrub = !free && bridge.status === 'ready' && timeline.length > 0;
  const step = timeline.stepped ? 1 : 1 / Math.max(1, fps);
  const at = Math.min(Math.max(0, t), timeline.length);
  const segIndex = segmentIndexAt(timeline.segments, at);
  const current = timeline.segments[segIndex];

  const [loop, setLoop] = useState<{ start: number; end: number } | null>(null);
  const loopActive = loop !== null && loop.start < loop.end;

  // Section repeat: wrap to the loop start after playing past its end.
  useEffect(() => {
    if (!loopActive || !bridge.playing || !canScrub || !loop) return;
    if (t >= loop.end) bridge.seek(loop.start);
  });

  const toggle = () => (bridge.playing ? bridge.pause() : bridge.play());

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The slider keeps native arrow handling (it seeks through onChange); buttons keep Space.
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === ' ' && e.target instanceof HTMLButtonElement) return;
    if (free) {
      if (e.key === ' ') {
        e.preventDefault();
        toggle();
      }
      return;
    }
    switch (e.key) {
      case ' ':
        e.preventDefault();
        toggle();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        bridge.seek(at - (e.shiftKey ? 1 : step));
        break;
      case 'ArrowRight':
        e.preventDefault();
        bridge.seek(at + (e.shiftKey ? 1 : step));
        break;
      case 'Home':
        e.preventDefault();
        bridge.seek(0);
        break;
      case 'End':
        e.preventDefault();
        bridge.seek(timeline.length);
        break;
    }
  };

  if (free) {
    return (
      <div
        data-testid="scrubber"
        aria-label={tr('review.scrub.label')}
        onKeyDown={onKeyDown}
        className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1.5 text-xs"
      >
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={bridge.playing ? tr('review.scrub.pause') : tr('review.scrub.play')}
          aria-pressed={bridge.playing}
          onClick={toggle}
        >
          {bridge.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <span className="text-muted-foreground" data-testid="scrubber-time">
          {formatTime(at, fps)}
        </span>
        <span className="ml-auto text-muted-foreground">{tr('review.scrub.live')}</span>
      </div>
    );
  }

  const prevStart = timeline.segments[segIndex - 1]?.start ?? 0;
  const nextStart = timeline.segments[segIndex + 1]?.start ?? timeline.length;
  return (
    <div
      data-testid="scrubber"
      aria-label={tr('review.scrub.label')}
      onKeyDown={onKeyDown}
      className="shrink-0 border-t border-border px-3 py-1.5 text-xs"
    >
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={tr('review.scrub.prevScene')}
          disabled={!canScrub}
          onClick={() => bridge.seek(prevStart)}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={tr('review.scrub.frameBack')}
          disabled={!canScrub}
          onClick={() => bridge.seek(at - step)}
        >
          <StepBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={bridge.playing ? tr('review.scrub.pause') : tr('review.scrub.play')}
          aria-pressed={bridge.playing}
          disabled={bridge.status !== 'ready'}
          onClick={toggle}
        >
          {bridge.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={tr('review.scrub.frameForward')}
          disabled={!canScrub}
          onClick={() => bridge.seek(at + step)}
        >
          <StepForward className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={tr('review.scrub.nextScene')}
          disabled={!canScrub}
          onClick={() => bridge.seek(nextStart)}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
        <input
          type="range"
          data-testid="scrubber-slider"
          aria-label={tr('review.scrub.seek')}
          min={0}
          max={timeline.length}
          step={step}
          value={at}
          disabled={!canScrub}
          onChange={(e) => bridge.seek(Number(e.target.value))}
          className="mx-2 min-w-0 flex-1"
        />
        <span className="shrink-0 tabular-nums text-muted-foreground" data-testid="scrubber-time">
          {formatTime(at, fps)} / {formatTime(timeline.length, fps)}
        </span>
        {current && (
          <span className="hidden shrink-0 text-muted-foreground md:inline" data-testid="scrubber-scene">
            {tr('review.scrub.currentScene', { id: current.id })}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-1">
        <div className="relative mx-[104px] h-1 flex-1" aria-hidden="true">
          {timeline.length > 0 &&
            timeline.segments.map((s) => (
              <div
                key={s.id}
                className={cn('absolute top-0 h-full w-px', s.start <= at ? 'bg-primary' : 'bg-border')}
                style={{ left: `${(s.start / timeline.length) * 100}%` }}
              />
            ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1" role="group" aria-label={tr('review.scrub.loop')}>
          {loopActive && loop && (
            <span className="mr-1 text-muted-foreground" data-testid="scrubber-loop">
              {tr('review.scrub.loopActive', { start: formatTime(loop.start, fps), end: formatTime(loop.end, fps) })}
            </span>
          )}
          <Button
            size="sm"
            variant={loopActive ? 'secondary' : 'ghost'}
            className="h-6 px-2"
            disabled={!canScrub}
            onClick={() => setLoop({ start: at, end: loop && loop.end > at ? loop.end : timeline.length })}
          >
            {tr('review.scrub.loopStart')}
          </Button>
          <Button
            size="sm"
            variant={loopActive ? 'secondary' : 'ghost'}
            className="h-6 px-2"
            disabled={!canScrub}
            onClick={() => setLoop({ start: loop && loop.start < at ? loop.start : 0, end: at })}
          >
            {tr('review.scrub.loopEnd')}
          </Button>
          {loop && (
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setLoop(null)}>
              {tr('review.scrub.loopClear')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
