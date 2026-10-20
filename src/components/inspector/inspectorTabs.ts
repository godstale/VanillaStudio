// 인스펙터 섹션 탭(Refactor-Spec-v2 §3.3). 노드의 재생 버튼처럼 바깥에서 탭을 열 때 같은 이름을 쓴다.
export const INSPECTOR_TABS = ['overview', 'guide', 'design', 'references', 'prompt', 'preview', 'history'] as const;
export type InspectorTab = (typeof INSPECTOR_TABS)[number];
