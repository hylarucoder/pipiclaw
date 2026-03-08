import { Type } from '@sinclair/typebox'
import { createChatStreamClient, type ChatStreamTransport } from '@pipiclaw/agent-core'
import {
  getModel,
  getModels,
  getProviders,
  modelsAreEqual
} from '@mariozechner/pi-ai/dist/models.js'
import { StringEnum } from '@mariozechner/pi-ai/dist/utils/typebox-helpers.js'
import { EventStream } from '@mariozechner/pi-ai/dist/utils/event-stream.js'
import { parseStreamingJson } from '@mariozechner/pi-ai/dist/utils/json-parse.js'
import { validateToolArguments } from '@mariozechner/pi-ai/dist/utils/validation.js'
import type { Context, Model, SimpleStreamOptions } from '@mariozechner/pi-ai/dist/types.js'

type RuntimeWindow = {
  api?: {
    chat?: ChatStreamTransport
  }
}

function getRuntimeWindow(): RuntimeWindow | undefined {
  if (typeof window === 'undefined') return undefined
  return window as RuntimeWindow
}

function hasIpcChatApi(
  runtimeWindow: RuntimeWindow | undefined
): runtimeWindow is RuntimeWindow & {
  api: {
    chat: ChatStreamTransport
  }
} {
  return (
    !!runtimeWindow?.api?.chat &&
    typeof runtimeWindow.api.chat.startStream === 'function' &&
    typeof runtimeWindow.api.chat.abortStream === 'function' &&
    typeof runtimeWindow.api.chat.onStreamEvent === 'function'
  )
}

function streamSimpleIpc(
  runtimeWindow: RuntimeWindow & { api: { chat: ChatStreamTransport } },
  model: Model<string>,
  context: Context,
  options?: SimpleStreamOptions
) {
  return createChatStreamClient(runtimeWindow.api.chat, model, context, options)
}

export function streamSimple(model: Model<string>, context: Context, options?: SimpleStreamOptions) {
  const runtimeWindow = getRuntimeWindow()
  if (!hasIpcChatApi(runtimeWindow)) {
    throw new Error('Renderer chat runtime requires window.api.chat IPC transport')
  }

  return streamSimpleIpc(runtimeWindow, model, context, options)
}

export function stream(model: Model<string>, context: Context, options?: SimpleStreamOptions) {
  return streamSimple(model, context, options)
}

export async function complete(model: Model<string>, context: Context, options?: SimpleStreamOptions) {
  const response = streamSimple(model, context, options)
  return await response.result()
}

export {
  EventStream,
  StringEnum,
  Type,
  getModel,
  getModels,
  getProviders,
  modelsAreEqual,
  parseStreamingJson,
  validateToolArguments
}
