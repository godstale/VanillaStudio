import { cn } from '@/lib/utils';

export interface AppMarkProps {
  className?: string;
  compact?: boolean;
}

// Placeholder brand mark: three stacked workspace panes in a rounded tile.
// Replace this file (and design/brand/*) with your own logo — see BRANDING.md.
export function AppMark({ className, compact = false }: AppMarkProps) {
  if (compact) {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={cn('h-4 w-4', className)}
        aria-hidden="true"
      >
        <rect
          x="3"
          y="5"
          width="26"
          height="22"
          rx="5"
          fill="currentColor"
          opacity="0.9"
        />
        <rect x="3" y="5" width="9" height="22" fill="#000" opacity="0.25" />
        <rect
          x="14.5"
          y="9"
          width="11"
          height="3"
          rx="1.5"
          fill="#000"
          opacity="0.35"
        />
        <rect
          x="14.5"
          y="14"
          width="8"
          height="3"
          rx="1.5"
          fill="#000"
          opacity="0.35"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn('h-8 w-8', className)}
      aria-hidden="true"
    >
      <rect
        x="6"
        y="10"
        width="52"
        height="44"
        rx="10"
        fill="currentColor"
        opacity="0.9"
      />
      <rect x="6" y="10" width="18" height="44" fill="#000" opacity="0.25" />
      <rect
        x="29"
        y="18"
        width="22"
        height="6"
        rx="3"
        fill="#000"
        opacity="0.35"
      />
      <rect
        x="29"
        y="28"
        width="16"
        height="6"
        rx="3"
        fill="#000"
        opacity="0.35"
      />
      <rect
        x="29"
        y="38"
        width="19"
        height="6"
        rx="3"
        fill="#000"
        opacity="0.35"
      />
    </svg>
  );
}

export default AppMark;
