export interface ChatChunkPayload {
  delta_content?: string
  thinking?: string
  finish_reason?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamChatOptions {
  model: string
  prompt: string
  messages?: Array<{ role: string; content: string }>
  onChunk: (chunk: ChatChunkPayload) => void
  onError?: (error: Error) => void
  onDone?: () => void
  signal?: AbortSignal
}

/**
 * 发起流式推理并逐帧解码 SSE 事件流
 */
export async function streamChatApi(options: StreamChatOptions): Promise<void> {
  const { model, prompt, messages, onChunk, onError, onDone, signal } = options

  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        messages,
      }),
      signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 留存半截行

      let currentEvent = 'message'

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7)
          continue
        }

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') {
            if (onDone) onDone()
            return
          }

          if (currentEvent === 'error') {
            throw new Error(dataStr)
          }

          try {
            const chunk: ChatChunkPayload = JSON.parse(dataStr)
            onChunk(chunk)
          } catch {
            // 纯文本 delta 降级
            onChunk({ delta_content: dataStr })
          }
        }
      }
    }

    if (onDone) onDone()
  } catch (err: unknown) {
    if (signal?.aborted) return
    const error = err instanceof Error ? err : new Error(String(err))
    if (onError) onError(error)
    else console.error('[SSE] Stream error:', error)
  }
}
