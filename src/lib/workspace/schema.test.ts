import { describe, expect, it } from 'vitest'
import { canvasFromPreset, workspaceSchema } from './schema'

const valid = {
  version: 1,
  workspaceId: 'ws_abc',
  name: 'Demo',
  canvas: canvasFromPreset('16:9'),
}

describe('workspaceSchema', () => {
  it('accepts a minimal workspace', () => {
    expect(workspaceSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts defaultAgent and view', () => {
    const r = workspaceSchema.safeParse({ ...valid, defaultAgent: 'claude', view: { x: 0, y: 0, zoom: 1 } })
    expect(r.success).toBe(true)
  })

  it.each([
    ['missing workspaceId', { ...valid, workspaceId: undefined }],
    ['wrong version', { ...valid, version: 2 }],
    ['empty name', { ...valid, name: '' }],
    ['fps 0', { ...valid, canvas: { ...valid.canvas, fps: 0 } }],
    ['float width', { ...valid, canvas: { ...valid.canvas, width: 100.5 } }],
    ['zero zoom', { ...valid, view: { x: 0, y: 0, zoom: 0 } }],
  ])('rejects %s', (_, input) => {
    expect(workspaceSchema.safeParse(input).success).toBe(false)
  })
})

describe('canvasFromPreset', () => {
  it('resolves presets', () => {
    expect(canvasFromPreset('9:16', 60)).toEqual({ aspect: '9:16', width: 1080, height: 1920, fps: 60 })
    expect(canvasFromPreset('1:1')).toMatchObject({ width: 1080, height: 1080, fps: 30 })
  })

  it('custom needs a size', () => {
    expect(() => canvasFromPreset('custom')).toThrow()
    expect(canvasFromPreset('custom', 24, { width: 800, height: 600 }).aspect).toBe('custom')
  })
})
