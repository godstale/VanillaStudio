import { z } from 'zod'

// 화면 규격은 워크스페이스 전역(D-030). 키 순서 = canonical 직렬화 순서.

export const CANVAS_PRESETS = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
} as const

export type CanvasPreset = keyof typeof CANVAS_PRESETS | 'custom'

export const canvasSchema = z.object({
  aspect: z.string().regex(/^\d+:\d+$/, 'aspect must look like 16:9'),
  width: z.number().int().min(16).max(7680),
  height: z.number().int().min(16).max(7680),
  fps: z.number().int().min(1).max(120),
})
export type Canvas = z.infer<typeof canvasSchema>

export const workspaceViewSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
})
export type WorkspaceView = z.infer<typeof workspaceViewSchema>

export const workspaceSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  canvas: canvasSchema,
  defaultAgent: z.string().min(1).optional(),
  view: workspaceViewSchema.optional(),
})
export type Workspace = z.infer<typeof workspaceSchema>

export function canvasFromPreset(preset: CanvasPreset, fps = 30, custom?: { width: number; height: number }): Canvas {
  if (preset === 'custom') {
    if (!custom) throw new Error('custom preset requires width/height')
    return { aspect: 'custom', ...custom, fps }
  }
  return { aspect: preset, ...CANVAS_PRESETS[preset], fps }
}
