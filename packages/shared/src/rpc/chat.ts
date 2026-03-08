import { z } from 'zod'

export const CHAT_STREAM_START_CHANNEL = 'chat:stream:start'
export const CHAT_STREAM_ABORT_CHANNEL = 'chat:stream:abort'
export const CHAT_STREAM_EVENT_CHANNEL = 'chat:stream:event'
export const CHAT_SESSION_LOAD_CHANNEL = 'chat:session:load'
export const CHAT_SESSION_SAVE_CHANNEL = 'chat:session:save'

export const chatStreamStartInputSchema = z.object({
  requestId: z.string().min(1),
  model: z.unknown(),
  context: z.unknown(),
  options: z.unknown().optional()
})

export const chatStreamAbortInputSchema = z.object({
  requestId: z.string().min(1)
})

const chatStreamEventKindSchema = z.enum(['event', 'error', 'end'])

export const chatStreamEventPayloadSchema = z
  .object({
    requestId: z.string().min(1),
    kind: chatStreamEventKindSchema,
    event: z.unknown().optional(),
    error: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'event' && value.event === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'event payload requires event'
      })
    }
    if (value.kind === 'error' && !value.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'error payload requires error message'
      })
    }
  })

export const chatStreamStartResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional()
})

export const chatSessionStateSchema = z.object({
  systemPrompt: z.string(),
  model: z.unknown(),
  thinkingLevel: z.string(),
  messages: z.array(z.unknown())
})

export const chatSessionSnapshotSchema = z.object({
  sessionId: z.string().min(1),
  state: chatSessionStateSchema
})

export const chatSessionLoadInputSchema = z.object({
  sessionId: z.string().min(1)
})

export const chatSessionLoadResultSchema = z.object({
  snapshot: chatSessionSnapshotSchema.nullable(),
  error: z.string().optional()
})

export const chatSessionSaveInputSchema = chatSessionSnapshotSchema

export const chatSessionSaveResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional()
})

export type ChatStreamStartInput = z.infer<typeof chatStreamStartInputSchema>
export type ChatStreamAbortInput = z.infer<typeof chatStreamAbortInputSchema>
export type ChatStreamEventPayload = z.infer<typeof chatStreamEventPayloadSchema>
export type ChatStreamStartResult = z.infer<typeof chatStreamStartResultSchema>
export type ChatSessionState = z.infer<typeof chatSessionStateSchema>
export type ChatSessionSnapshot = z.infer<typeof chatSessionSnapshotSchema>
export type ChatSessionLoadInput = z.infer<typeof chatSessionLoadInputSchema>
export type ChatSessionLoadResult = z.infer<typeof chatSessionLoadResultSchema>
export type ChatSessionSaveInput = z.infer<typeof chatSessionSaveInputSchema>
export type ChatSessionSaveResult = z.infer<typeof chatSessionSaveResultSchema>
