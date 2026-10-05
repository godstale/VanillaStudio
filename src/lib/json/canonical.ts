// 정규화 직렬화(Technical-Design §8.3): 같은 입력 → 같은 바이트.
// 키 순서는 입력 객체의 삽입 순서(= zod 스키마 정의 순)를 그대로 따른다.

export interface CanonicalOptions {
  /** 이 키 아래의 숫자(초 단위 시간)는 소수 3자리로 고정한다. */
  timeKeys?: ReadonlySet<string>
}

const INDENT = '  '

function formatTime(n: number): string {
  // -0.0004 같은 값이 "-0.000"이 되지 않게 한다.
  const s = n.toFixed(3)
  return Number(s) === 0 ? '0.000' : s
}

function write(value: unknown, depth: number, key: string | null, opts: CanonicalOptions): string {
  if (value === null) return 'null'
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'number':
      if (!Number.isFinite(value)) throw new Error('canonical: non-finite number')
      return key !== null && opts.timeKeys?.has(key) ? formatTime(value) : JSON.stringify(value)
    case 'object':
      break
    default:
      throw new Error(`canonical: unsupported type ${typeof value}`)
  }
  const pad = INDENT.repeat(depth + 1)
  const end = INDENT.repeat(depth)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => pad + write(v === undefined ? null : v, depth + 1, key, opts))
    return `[\n${items.join(',\n')}\n${end}]`
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return '{}'
  const props = entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${write(v, depth + 1, k, opts)}`)
  return `{\n${props.join(',\n')}\n${end}}`
}

export function canonicalStringify(value: unknown, opts: CanonicalOptions = {}): string {
  return `${write(value, 0, null, opts)}\n`
}
