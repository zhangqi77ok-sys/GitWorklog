export type UpstreamProtocol =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'gemini-content';

export interface UpstreamRequestConfig {
  protocol?: UpstreamProtocol;
  baseUrl: string;
  apiKey?: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: string; content: string }>;
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
}

export interface PreparedUpstreamRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  protocol: UpstreamProtocol;
}

export interface ParsedStreamChunk {
  textDelta: string;
  thoughtDelta: string;
  isDone: boolean;
  toolCalls?: Array<{ id?: string; name: string; args: Record<string, any> }>;
}

/**
 * Automatically sniff upstream protocol based on platform, model name and endpoint
 */
export function inferUpstreamProtocol(baseUrl: string, model: string): UpstreamProtocol {
  const lowerBase = (baseUrl || '').toLowerCase();
  const lowerModel = (model || '').toLowerCase();

  // 1. Anthropic Messages API
  if (lowerBase.includes('anthropic.com') || lowerBase.includes('/messages') || (lowerModel.startsWith('claude') && !lowerBase.includes('chat/completions'))) {
    return 'anthropic-messages';
  }

  // 2. OpenAI Responses API
  if (lowerBase.includes('/responses') || lowerModel.includes('responses') || lowerModel.includes('codex')) {
    return 'openai-responses';
  }

  // 3. Gemini Content API
  if (lowerBase.includes('generativelanguage.googleapis.com')) {
    return 'gemini-content';
  }

  // Default: OpenAI standard Chat Completions
  return 'openai-chat';
}

/**
 * Build the exact HTTP request URL, headers, and JSON body for the target protocol
 */
export function buildUpstreamRequest(config: UpstreamRequestConfig): PreparedUpstreamRequest {
  const protocol = config.protocol || inferUpstreamProtocol(config.baseUrl, config.model);
  const base = config.baseUrl.replace(/\/+$/, '');
  const apiKey = config.apiKey || '';

  if (protocol === 'anthropic-messages') {
    let url = base;
    if (!url.endsWith('/messages')) {
      url = url.endsWith('/v1') ? `${url}/messages` : `${url}/v1/messages`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };

    if (apiKey) {
      if (apiKey.startsWith('sk-ant-') || !apiKey.startsWith('Bearer ')) {
        headers['x-api-key'] = apiKey;
      } else {
        headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      }
    }

    // Filter out system messages from messages list; Anthropic takes top-level system
    let systemText = config.systemPrompt || '';
    const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of config.messages) {
      if (msg.role === 'system') {
        if (!systemText) systemText = msg.content;
        else systemText += '\n\n' + msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: 'user', content: 'Hello' });
    }

    const bodyObj: Record<string, any> = {
      model: config.model,
      max_tokens: config.maxTokens || 8192,
      messages: anthropicMessages,
      stream: true,
    };

    if (systemText) {
      bodyObj.system = systemText;
    }
    if (typeof config.temperature === 'number') {
      bodyObj.temperature = config.temperature;
    }

    return {
      url,
      headers,
      body: JSON.stringify(bodyObj),
      protocol,
    };
  }

  if (protocol === 'openai-responses') {
    let url = base;
    if (!url.endsWith('/responses')) {
      url = url.endsWith('/v1') ? `${url}/responses` : `${url}/v1/responses`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
    }

    const bodyObj = {
      model: config.model,
      instructions: config.systemPrompt || 'You are Tcode Next-Gen AI Coding Assistant.',
      input: config.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
      stream: true,
    };

    return {
      url,
      headers,
      body: JSON.stringify(bodyObj),
      protocol,
    };
  }

  // Default: OpenAI Chat Completions (openai-chat)
  let url = base;
  if (!url.endsWith('/chat/completions')) {
    url = url.endsWith('/v1') ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
  }

  const formattedMessages: Array<{ role: string; content: string }> = [];
  if (config.systemPrompt && !config.messages.some((m) => m.role === 'system')) {
    formattedMessages.push({ role: 'system', content: config.systemPrompt });
  }
  formattedMessages.push(...config.messages);

  const bodyObj: Record<string, any> = {
    model: config.model,
    messages: formattedMessages,
    stream: true,
  };
  if (typeof config.temperature === 'number') {
    bodyObj.temperature = config.temperature;
  }

  return {
    url,
    headers,
    body: JSON.stringify(bodyObj),
    protocol: 'openai-chat',
  };
}

/**
 * Parse a raw SSE line according to protocol specification
 */
export function parseSseLine(protocol: UpstreamProtocol, rawLine: string): ParsedStreamChunk {
  const line = rawLine.trim();
  const res: ParsedStreamChunk = {
    textDelta: '',
    thoughtDelta: '',
    isDone: false,
  };

  if (!line || line.startsWith(':')) {
    return res;
  }

  // Standard SSE completion terminators
  if (line === 'data: [DONE]' || line === 'event: message_stop' || line === 'event: done' || line === 'event: response.done') {
    res.isDone = true;
    return res;
  }

  let jsonStr = '';
  if (line.startsWith('data: ')) {
    jsonStr = line.slice(6).trim();
  } else if (line.startsWith('event: ')) {
    return res;
  } else {
    jsonStr = line;
  }

  if (jsonStr === '[DONE]') {
    res.isDone = true;
    return res;
  }

  try {
    const data = JSON.parse(jsonStr);

    // 1. Anthropic Messages SSE format
    if (protocol === 'anthropic-messages') {
      if (data.type === 'message_stop') {
        res.isDone = true;
      } else if (data.type === 'content_block_delta') {
        if (data.delta?.type === 'text_delta' && data.delta.text) {
          res.textDelta = data.delta.text;
        } else if (data.delta?.type === 'thinking_delta' && data.delta.thinking) {
          res.thoughtDelta = data.delta.thinking;
        }
      } else if (data.delta?.text) {
        res.textDelta = data.delta.text;
      }
      return res;
    }

    // 2. OpenAI Responses API SSE format
    if (protocol === 'openai-responses') {
      if (data.type === 'response.done' || data.type === 'done') {
        res.isDone = true;
      } else if (data.type === 'response.text.delta' && data.delta) {
        res.textDelta = data.delta;
      } else if (data.delta?.text) {
        res.textDelta = data.delta.text;
      }
      return res;
    }

    // 3. OpenAI Chat Completions format (openai-chat)
    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      const delta = choice.delta;

      if (delta) {
        if (delta.reasoning_content) {
          res.thoughtDelta = delta.reasoning_content;
        } else if (delta.reasoning) {
          res.thoughtDelta = delta.reasoning;
        }

        if (delta.content) {
          res.textDelta = delta.content;
        }
      }

      if (choice.finish_reason === 'stop' || choice.finish_reason === 'length') {
        // stream might end
      }
    }
  } catch {
    // Ignore partial json errors
  }

  return res;
}
