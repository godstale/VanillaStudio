import { createContext, useContext } from 'react';
import type { PlaygroundItem, PlaygroundKind } from './types';

export interface AddPlaygroundInput {
  title: string;
  kind: PlaygroundKind;
  dirPath: string;
  sourceProject: string | null;
  tags?: string[];
}

export interface UpdatePlaygroundInput {
  title?: string;
  tags?: string[];
}

export interface PlaygroundContextValue {
  items: PlaygroundItem[];
  isLoaded: boolean;
  error: string | null;
  refresh(): Promise<void>;
  /** Persist one item. Resolves with the new id. */
  addItem(input: AddPlaygroundInput): Promise<string>;
  removeItem(id: string): Promise<void>;
  updateItem(id: string, patch: UpdatePlaygroundInput): Promise<void>;
}

export const PlaygroundContext = createContext<PlaygroundContextValue | null>(null);

export function usePlayground(): PlaygroundContextValue {
  const ctx = useContext(PlaygroundContext);
  if (!ctx) throw new Error('usePlayground must be used within PlaygroundProvider');
  return ctx;
}
