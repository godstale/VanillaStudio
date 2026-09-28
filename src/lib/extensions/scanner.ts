import { invoke } from '@tauri-apps/api/core';
import type { ExtensionManifest } from '@/lib/types/extension';

interface DirEntry {
  name?: string;
  path?: string;
  is_directory?: boolean;
  isDirectory?: boolean;
}

interface ExtensionJson {
  name?: unknown;
  description?: unknown;
  version?: unknown;
}

function isDir(entry: DirEntry): boolean {
  return entry.is_directory ?? entry.isDirectory ?? false;
}

function entryPath(parent: string, name: string, fallback?: string): string {
  if (fallback) return fallback;
  const sep = parent.includes('\\') ? '\\' : '/';
  return `${parent}${parent.endsWith(sep) ? '' : sep}${name}`;
}

async function readManifest(
  dirPath: string,
): Promise<ExtensionManifest | null> {
  const sep = dirPath.includes('\\') ? '\\' : '/';
  const manifestPath = `${dirPath}${sep}extension.json`;
  try {
    const raw = await invoke<string>('read_text_file', {
      path: manifestPath,
      workspaceRoot: null,
    });
    const parsed = JSON.parse(raw) as ExtensionJson;
    if (
      typeof parsed.name !== 'string' ||
      typeof parsed.description !== 'string'
    ) {
      return null;
    }
    const readmePath = `${dirPath}${sep}README.md`;
    let hasReadme = false;
    try {
      await invoke<string>('read_text_file', {
        path: readmePath,
        workspaceRoot: null,
      });
      hasReadme = true;
    } catch {
      hasReadme = false;
    }
    return {
      name: parsed.name,
      description: parsed.description,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
      dirPath,
      readmePath: hasReadme ? readmePath : null,
    };
  } catch {
    return null;
  }
}

// Scans `{workspaceRoot}/.extensions/*/` for `extension.json` manifests.
// Folders without a valid manifest are skipped silently.
export async function scanWorkspaceExtensions(
  workspaceRoot: string,
): Promise<ExtensionManifest[]> {
  const sep = workspaceRoot.includes('\\') ? '\\' : '/';
  const base = `${workspaceRoot}${sep}.extensions`;
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', {
      path: base,
      workspaceRoot,
    });
  } catch {
    return [];
  }
  const manifests: ExtensionManifest[] = [];
  for (const entry of entries) {
    if (!isDir(entry) || !entry.name) continue;
    const manifest = await readManifest(
      entryPath(base, entry.name, entry.path),
    );
    if (manifest) manifests.push(manifest);
  }
  manifests.sort((a, b) => a.name.localeCompare(b.name));
  return manifests;
}

export async function readExtensionReadme(
  manifest: ExtensionManifest,
): Promise<string> {
  if (!manifest.readmePath) return '';
  try {
    return await invoke<string>('read_text_file', {
      path: manifest.readmePath,
      workspaceRoot: null,
    });
  } catch {
    return '';
  }
}
