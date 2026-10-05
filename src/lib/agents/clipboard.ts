import type { GuideContext } from '@/lib/guides/agentsMd';
import { assemblePrompt } from '@/lib/guides/prompts';

// 에이전트에게 줄 프롬프트와 클립보드 전달(D-022). 앱은 에이전트를 조종하지 않고, 프롬프트를 클립보드에 넣고 선택적으로 터미널에 붙여넣을 뿐이다.

export type AgentPromptKind = 'generate' | 'revise';

/**
 * 이 신에서 지금 보낼 프롬프트. 수정 필요 상태(needs-revision)면 revise, 아니면 generate.
 * 인스펙터 미리보기와 클립보드 복사가 같은 함수를 쓰므로 둘의 내용이 항상 같다.
 */
export function promptForScene(ctx: GuideContext, changedFields?: readonly string[]): { kind: AgentPromptKind; text: string } {
  const kind: AgentPromptKind = ctx.scene.status === 'needs-revision' ? 'revise' : 'generate';
  return { kind, text: assemblePrompt(kind, ctx, kind === 'revise' ? { changedFields } : {}) };
}

/** 클립보드에 쓴다. 실패하면 false(권한 거부·비포커스 등). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래 폴백으로 넘어간다.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
