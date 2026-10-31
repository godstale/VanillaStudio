// DOM-only frames (motion graphics and static pages without a <canvas>) are rasterized in-page:
// the live tree is cloned with its computed styles inlined, wrapped in an SVG <foreignObject> and
// drawn onto a canvas. No dependency; it is a thumbnail, so pseudo-elements and web fonts are best effort.

const XHTML = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';
const URL_IN_CSS = /url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(blob);
  });
}

/** Same-origin / CORS-readable resources only; anything else stays as is and renders blank inside the SVG. */
async function inlineUrl(url: string): Promise<string> {
  try {
    const res = await fetch(new URL(url, document.baseURI).href);
    if (!res.ok) return url;
    return await blobToDataUrl(await res.blob());
  } catch {
    return url;
  }
}

function copyComputedStyle(from: Element, to: Element): void {
  const cs = getComputedStyle(from);
  let css = '';
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i]!;
    css += `${name}:${cs.getPropertyValue(name)};`;
  }
  (to as HTMLElement).setAttribute('style', css);
}

async function cloneWithStyles(src: Element): Promise<Element> {
  if (src instanceof HTMLCanvasElement) {
    const img = document.createElement('img');
    try {
      img.setAttribute('src', src.toDataURL('image/png'));
    } catch {
      // tainted / cleared buffer: leave the box empty
    }
    copyComputedStyle(src, img);
    return img;
  }
  const clone = src.cloneNode(false) as Element;
  copyComputedStyle(src, clone);
  if (clone instanceof HTMLElement) {
    // Keep layout stable: the form value / scroll position are not part of the cloned markup.
    if (src instanceof HTMLInputElement) clone.setAttribute('value', src.value);
    const bg = clone.style.getPropertyValue('background-image');
    if (bg.includes('url(')) {
      const urls = [...bg.matchAll(URL_IN_CSS)].map((m) => m[2]!);
      let next = bg;
      for (const u of urls) next = next.replace(u, await inlineUrl(u));
      clone.style.setProperty('background-image', next);
    }
  }
  if (clone instanceof HTMLImageElement && src instanceof HTMLImageElement && src.currentSrc && !src.currentSrc.startsWith('data:')) {
    clone.setAttribute('src', await inlineUrl(src.currentSrc));
    clone.removeAttribute('srcset');
  }
  for (const child of Array.from(src.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) clone.appendChild(child.cloneNode(true));
    else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME' || el.tagName === 'NOSCRIPT') continue;
      clone.appendChild(await cloneWithStyles(el));
    }
  }
  return clone;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}

/** PNG data URL of `<body>` as currently laid out in the viewport, scaled by `scale`. */
export async function captureDom(scale: number): Promise<string> {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  if (!width || !height) throw new Error('capture: the page has no size');

  const body = await cloneWithStyles(document.body);
  const html = getComputedStyle(document.documentElement);
  const wrap = document.createElementNS(XHTML, 'div');
  wrap.setAttribute('xmlns', XHTML);
  wrap.setAttribute('style', `width:${width}px;height:${height}px;overflow:hidden;background-color:${html.backgroundColor};`);
  // body margin / size come from its computed style; pin the size to the viewport.
  (body as HTMLElement).style.setProperty('width', `${width}px`);
  (body as HTMLElement).style.setProperty('height', `${height}px`);
  (body as HTMLElement).style.setProperty('margin', '0');
  wrap.appendChild(body);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('width', '100%');
  fo.setAttribute('height', '100%');
  fo.appendChild(wrap);
  svg.appendChild(fo);

  const markup = new XMLSerializer().serializeToString(svg);
  let img: HTMLImageElement;
  try {
    img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
  } catch {
    throw new Error('capture: the page could not be rasterized');
  }
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('capture: 2d context unavailable');
  ctx.drawImage(img, 0, 0, out.width, out.height);
  try {
    return out.toDataURL('image/png');
  } catch {
    throw new Error('capture: the rasterized page is tainted');
  }
}
