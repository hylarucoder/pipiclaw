import { z } from 'zod'

export const IMAGEN_GENERATE_CHANNEL = 'imagen:generate'

export const imagenAspectRatioSchema = z.enum(['1:1', '16:9', '9:16'])

export const imagenGenerateInputSchema = z.object({
  prompt: z.string().min(1),
  aspectRatio: imagenAspectRatioSchema,
  count: z.number().int().min(1).max(4)
})

export const imagenGeneratedImageSchema = z.object({
  dataUrl: z.string().min(1),
  mediaType: z.string().min(1)
})

export const imagenGenerateResultSchema = z.object({
  modelId: z.string().min(1),
  images: z.array(imagenGeneratedImageSchema),
  error: z.string().optional()
})

export type ImagenAspectRatio = z.infer<typeof imagenAspectRatioSchema>
export type ImagenGenerateInput = z.infer<typeof imagenGenerateInputSchema>
export type ImagenGeneratedImage = z.infer<typeof imagenGeneratedImageSchema>
export type ImagenGenerateResult = z.infer<typeof imagenGenerateResultSchema>
