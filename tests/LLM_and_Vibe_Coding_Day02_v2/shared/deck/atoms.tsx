// Smallest shared units. Copy always arrives from content.json.
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';
import { imageUrl, type Figure as FigureSpec, type Rich as RichText } from './content';

type TagType = ElementType<{ className?: string; style?: CSSProperties; children?: ReactNode }>;

/** Renders `**amber**` highlights and `\n` breaks. */
export function Rich({ text, as: Tag = 'span', className, style }: { text?: RichText; as?: TagType; className?: string; style?: CSSProperties }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <Tag className={className} style={style}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split('**').map((part, pi) => (pi % 2 === 1 ? <em key={pi}>{part}</em> : <Fragment key={pi}>{part}</Fragment>))}
        </Fragment>
      ))}
    </Tag>
  );
}

/** Keeps its slot in the layout while hidden, so build steps never shift what is already on screen. */
export function Reveal({ shown, as: Tag = 'div', className = '', style, children }: { shown: boolean; as?: TagType; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <Tag className={`reveal ${className}`} data-shown={shown} style={style}>
      {children}
    </Tag>
  );
}

const CAPTION_SPACE = 40;
const PAPER_PAD = 40;

/**
 * Scales the image to the largest size that fits the figure box (a size container) at its own aspect ratio,
 * so the rounded frame hugs the picture instead of letterboxing it.
 */
export function Figure({ figure, className = '', style }: { figure: FigureSpec; className?: string; style?: CSSProperties }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  const measure = (img: HTMLImageElement) => img.naturalWidth > 0 && setRatio(img.naturalWidth / img.naturalHeight);
  useEffect(() => {
    if (ref.current?.complete) measure(ref.current);
  }, []);
  const pad = figure.paper ? PAPER_PAD : 0;
  const reserve = (figure.caption ? CAPTION_SPACE : 0) + pad;
  const width = ratio ? `min(calc(100cqw - ${pad}px), calc((100cqh - ${reserve}px) * ${ratio}))` : undefined;
  return (
    <figure className={`fig ${figure.paper ? 'fig--paper' : ''} ${className}`} style={style}>
      <div className="fig-frame">
        <img ref={ref} src={imageUrl(figure.src)} alt={figure.caption ?? ''} onLoad={(e) => measure(e.currentTarget)} style={{ width, visibility: ratio ? 'visible' : 'hidden' }} draggable={false} />
      </div>
      {figure.caption && <figcaption>{figure.caption}</figcaption>}
    </figure>
  );
}

export function Bullets({ items, shown = Infinity, className = '' }: { items?: RichText[]; shown?: number; className?: string }) {
  if (!items?.length) return null;
  return (
    <ul className={`bullets ${className}`}>
      {items.map((b, i) => (
        <Reveal key={i} as="li" shown={i < shown}>
          <Rich text={b} />
        </Reveal>
      ))}
    </ul>
  );
}

/** The key line at the bottom of a screen (the template's subtitle box). */
export function Note({ text, shown = true }: { text?: RichText; shown?: boolean }) {
  if (!text) return null;
  return (
    <Reveal className="note" shown={shown}>
      <Rich text={text} />
    </Reveal>
  );
}
