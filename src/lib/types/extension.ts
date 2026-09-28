export interface ExtensionManifest {
  name: string;
  description: string;
  version?: string;
  dirPath: string;
  readmePath: string | null;
}

export type ExtensionSource = 'workspace' | 'builtin';
