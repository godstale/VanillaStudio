// 워크스페이스를 바꾸면 그 워크스페이스에 묶인 프로세스(터미널·프리뷰 서버)를 정리해야 한다.
// 실행 중인 작업은 여기에 등록하고, 전환 UI가 목록을 보고 사용자 확인을 받는다. 정리 실행은 등록한 쪽의 onStop이 맡는다.

export interface BusyTask {
  label: string;
  /** 전환이 확정되면 호출된다. 터미널 종료·서버 중지 등. */
  onStop: () => void | Promise<void>;
}

const tasks = new Map<symbol, BusyTask>();

/** 등록 해제 함수를 돌려준다. 작업이 스스로 끝나면 호출해야 한다. */
export function registerBusy(task: BusyTask): () => void {
  const id = Symbol(task.label);
  tasks.set(id, task);
  return () => {
    tasks.delete(id);
  };
}

export function listBusy(): string[] {
  return [...tasks.values()].map((t) => t.label);
}

/** 모든 등록 작업을 정리한다. 하나가 실패해도 나머지를 계속 정리하고, 실패 수를 돌려준다. */
export async function stopAllBusy(): Promise<number> {
  let failed = 0;
  for (const task of [...tasks.values()]) {
    try {
      await task.onStop();
    } catch {
      failed += 1;
    }
  }
  tasks.clear();
  return failed;
}
