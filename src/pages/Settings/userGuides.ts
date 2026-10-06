/** 앱 안에서 안내하는 사용자 문서(저장소 `Docs/User-Guide/`). 문서를 추가·이름 변경하면 여기와 사전 키를 함께 고친다. */
export const USER_GUIDES = [
  { file: '01-getting-started.md', key: 'userGuide.gettingStarted' },
  { file: '02-doctor.md', key: 'userGuide.doctor' },
  { file: '03-scenes-and-guides.md', key: 'userGuide.scenes' },
  { file: '04-sequence-and-playground.md', key: 'userGuide.sequence' },
  { file: '05-references.md', key: 'userGuide.references' },
  { file: '06-sharing-and-templates.md', key: 'userGuide.sharing' },
  { file: '07-troubleshooting.md', key: 'userGuide.troubleshooting' },
] as const;
