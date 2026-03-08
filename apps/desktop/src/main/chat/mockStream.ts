type MockModel = {
  api?: string
  provider?: string
  id?: string
}

type MockAssistantMessage = {
  role: 'assistant'
  content: Array<{ type: 'text'; text: string }>
  api: string
  provider: string
  model: string
  usage: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: {
      input: number
      output: number
      cacheRead: number
      cacheWrite: number
      total: number
    }
  }
  stopReason: 'stop'
  timestamp: number
}

type MockDoneEvent = {
  type: 'done'
  reason: 'stop'
  message: MockAssistantMessage
}

function extractLatestUserText(context: unknown): string {
  if (!context || typeof context !== 'object') return ''
  const messages = (context as { messages?: unknown }).messages
  if (!Array.isArray(messages)) return ''

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || typeof message !== 'object') continue
    const role = (message as { role?: unknown }).role
    if (role !== 'user' && role !== 'user-with-attachments') continue

    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      const textPart = content.find(
        (part) =>
          part &&
          typeof part === 'object' &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
      ) as { text?: string } | undefined
      if (textPart?.text) return textPart.text
    }
  }

  return ''
}

export async function* createMockAssistantStream(
  model: MockModel,
  context: unknown
): AsyncGenerator<MockDoneEvent> {
  const latestUserText = extractLatestUserText(context).trim()
  const reply = latestUserText
    ? `Mock response: ${latestUserText}`
    : 'Mock response from test stream.'

  const message: MockAssistantMessage = {
    role: 'assistant',
    content: [{ type: 'text', text: reply }],
    api: model.api ?? 'anthropic-messages',
    provider: model.provider ?? 'mock-provider',
    model: model.id ?? 'mock-model',
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0
      }
    },
    stopReason: 'stop',
    timestamp: Date.now()
  }

  yield {
    type: 'done',
    reason: 'stop',
    message
  }
}
