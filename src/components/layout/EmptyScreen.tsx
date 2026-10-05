import type { ReactNode } from 'react';

export function EmptyScreen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
