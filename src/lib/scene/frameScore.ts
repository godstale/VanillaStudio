// 썸네일 후보 프레임이 "비어 있는지"를 판별한다. 모션은 시작·끝이 빈 화면인 경우가 많아 한 지점만 찍으면 실패한다.
// 색 분포 대신 이웃 픽셀 대비(edge)를 쓴다: 단색·그라디언트 배경은 0에 가깝고, 글자·도형이 있으면 올라간다.

const EDGE_THRESHOLD = 48;

/** 가로·세로 이웃과 RGB 차이가 큰 픽셀의 비율(0~1). */
export function edgeScore(data: Uint8ClampedArray, width: number, height: number): number {
  let edges = 0;
  let total = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      const r = i + 4;
      const d = i + width * 4;
      const dx = Math.abs(data[i]! - data[r]!) + Math.abs(data[i + 1]! - data[r + 1]!) + Math.abs(data[i + 2]! - data[r + 2]!);
      const dy = Math.abs(data[i]! - data[d]!) + Math.abs(data[i + 1]! - data[d + 1]!) + Math.abs(data[i + 2]! - data[d + 2]!);
      if (dx > EDGE_THRESHOLD || dy > EDGE_THRESHOLD) edges++;
      total++;
    }
  }
  return total ? edges / total : 0;
}

/** PNG data URL을 디코드해 edgeScore를 구한다. 디코드 실패는 0(빈 화면 취급). */
export async function scoreFrame(dataUrl: string): Promise<number> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(img, 0, 0);
    return edgeScore(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  } catch {
    return 0;
  }
}

/** 이 점수 이상이면 내용이 충분해 더 찍지 않는다. */
export const RICH_SCORE = 0.02;

export interface ScoredFrame {
  dataUrl: string;
  score: number;
}

/** 가장 내용이 많은 프레임의 70% 이상인 것 중 가장 앞선 프레임(전환 중간보다 안정된 앞쪽을 선호). 후보가 없으면 null. */
export function pickBestFrame(frames: readonly ScoredFrame[]): ScoredFrame | null {
  if (frames.length === 0) return null;
  const max = Math.max(...frames.map((f) => f.score));
  return frames.find((f) => f.score >= max * 0.7) ?? frames[0]!;
}
