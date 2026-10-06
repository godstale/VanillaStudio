import { invoke } from '@tauri-apps/api/core';
import { packageInfoSchema, packReportSchema, type PackageInfo, type PackReport } from './manifest';

// Rust `.vsx` 명령 래퍼(T7.1·T7.2). 명령 문자열은 없다: 경로와 옵션만 넘기고 Rust가 검증한다. 돌려받은 값은 화면에서 쓰기 전에 다시 검증한다.

export interface PackOptions {
  /** 신 하나만 담을 때 그 폴더 이름. 없으면 시퀀스 전체. */
  scene?: string;
  includeReferenceMedia?: boolean;
  templateDirs?: string[];
}

export async function createPackage(workspaceRoot: string, outPath: string, options: PackOptions = {}): Promise<PackReport> {
  const raw = await invoke<unknown>('create_vsx', {
    workspaceRoot,
    outPath,
    options: { scene: options.scene ?? null, includeReferenceMedia: options.includeReferenceMedia ?? false, templateDirs: options.templateDirs ?? [] },
  });
  return packReportSchema.parse(raw);
}

/** 열기 전 검사(zip-slip·심링크·해시 등은 Rust가 거부한다). 거부 이유는 코드 문자열로 던져진다. */
export async function inspectPackage(path: string): Promise<PackageInfo> {
  return packageInfoSchema.parse(await invoke<unknown>('inspect_vsx', { path }));
}

export function importScene(workspaceRoot: string, path: string, sourceSlug: string, targetSlug: string): Promise<string[]> {
  return invoke<string[]>('extract_vsx_scene', { workspaceRoot, path, sourceSlug, targetSlug });
}

export function importWorkspace(path: string, destDir: string): Promise<string[]> {
  return invoke<string[]>('extract_vsx_workspace', { path, destDir });
}

/** Rust 거부 코드 → i18n 키. 모르는 코드는 null(원문을 보여 준다). */
export function packageErrorKey(message: string): string | null {
  const code = message.split(':')[0].trim();
  const map: Record<string, string> = {
    'not-a-zip': 'package.err.notZip',
    'manifest-missing': 'package.err.manifest',
    'manifest-invalid': 'package.err.manifest',
    'manifest-duplicate-path': 'package.err.manifest',
    'unsupported-format-version': 'package.err.version',
    'unsafe-entry-name': 'package.err.unsafe',
    'symlink-entry': 'package.err.unsafe',
    'encrypted-entry': 'package.err.unsafe',
    'hash-mismatch': 'package.err.tampered',
    'unlisted-file': 'package.err.tampered',
    'missing-file': 'package.err.tampered',
    'duplicate-entry': 'package.err.tampered',
    'too-many-files': 'package.err.tooLarge',
    'entry-too-large': 'package.err.tooLarge',
    'package-too-large': 'package.err.tooLarge',
    'scene-exists': 'package.err.sceneExists',
    'would-overwrite': 'package.err.exists',
    'destination-not-empty': 'package.err.notEmpty',
    'output-exists': 'package.err.outputExists',
    'nothing-to-package': 'package.err.nothing',
  };
  return map[code] ?? null;
}
