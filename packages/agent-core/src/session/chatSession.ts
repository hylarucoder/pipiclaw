import type { ChatSessionState } from '@pipiclaw/shared/rpc/chat'

export const DEFAULT_AGENT_SYSTEM_PROMPT =
  '你是 PiPiClaw Draw Studio 的协作助手。回答简洁，优先输出可执行步骤。'

export const AGENT_THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh'
] as const

export type AgentThinkingLevel = (typeof AGENT_THINKING_LEVELS)[number]

export type PersistedAgentStateSource = {
  state: {
    systemPrompt?: string | null
    model: unknown
    thinkingLevel?: string | null
    messages?: unknown[] | null
  }
}

export function cloneSerializable<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

export function buildChatSessionId(provider: string, modelId: string): string {
  return `chat:${provider}:${modelId}`
}

export function normalizeThinkingLevel(
  thinkingLevel: unknown,
  fallback: AgentThinkingLevel = 'off'
): AgentThinkingLevel {
  if (
    typeof thinkingLevel === 'string' &&
    (AGENT_THINKING_LEVELS as readonly string[]).includes(thinkingLevel)
  ) {
    return thinkingLevel as AgentThinkingLevel
  }

  return fallback
}

export function createPersistedChatSessionState(
  source: PersistedAgentStateSource,
  fallbackSystemPrompt = DEFAULT_AGENT_SYSTEM_PROMPT
): ChatSessionState {
  return {
    systemPrompt: source.state.systemPrompt || fallbackSystemPrompt,
    model: cloneSerializable(source.state.model),
    thinkingLevel: normalizeThinkingLevel(source.state.thinkingLevel),
    messages: cloneSerializable(source.state.messages ?? [])
  }
}
