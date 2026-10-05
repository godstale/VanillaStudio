import { invoke } from '@tauri-apps/api/core';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';
import { newSequence, parseSequence, SEQUENCE_FILE, serializeSequence, type Sequence } from './schema';

/** sequence.json을 읽는다. 없으면 빈 시퀀스. 다른 워크스페이스의 파일이면 거부한다(D-029). */
export async function readSequence(root: string, workspaceId: string): Promise<Sequence> {
  const text = await readOptionalFile(root, SEQUENCE_FILE);
  if (text === null) return newSequence(workspaceId);
  const seq = parseSequence(text);
  if (seq.workspaceId !== workspaceId) {
    throw new Error(`sequence.json belongs to another workspace (${seq.workspaceId})`);
  }
  return seq;
}

export async function writeSequence(root: string, seq: Sequence): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, SEQUENCE_FILE), contents: serializeSequence(seq), workspaceRoot: root });
}
