import { postJson, postForStream, readSSE } from './http';
import type {
  ChatRequest,
  ChatResult,
  ProviderCredentials,
  ProviderModule,
} from './types';

const DEFAULT_BASE = 'https://api.anthropic.com';
const API_VERSION = '2023-06-01';

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

function headers(creds: ProviderCredentials) {
  return {
    'x-api-key': creds.apiKey,
    'anthropic-version': API_VERSION,
    // Necessario para chamar a API direto do navegador/extensao.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

function buildBody(req: ChatRequest, stream: boolean) {
  // Anthropic separa o system dos turnos user/assistant.
  const system = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = req.messages.filter((m) => m.role !== 'system');
  const lastUserIdx = turns.map((m) => m.role).lastIndexOf('user');
  const messages = turns.map((m, i) => {
    if (i === lastUserIdx && req.images?.length) {
      return {
        role: 'user' as const,
        content: [
          ...req.images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mimeType, data: img.base64 },
          })),
          { type: 'text' as const, text: m.content },
        ],
      };
    }
    return { role: m.role as 'user' | 'assistant', content: m.content };
  });
  return {
    model: req.model,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature,
    ...(system ? { system } : {}),
    ...(req.search
      ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] }
      : {}),
    ...(stream ? { stream: true } : {}),
    messages,
  };
}

// Anthropic Messages API. Nao faz transcricao de audio (sem capability 'transcribe').
export const anthropic: ProviderModule = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  capabilities: ['chat', 'vision', 'search'],
  defaultModels: {
    chat: 'claude-sonnet-5',
  },
  suggestedModels: {
    chat: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  },

  async chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const data = await postJson<AnthropicResponse>(
      'anthropic',
      `${base}/v1/messages`,
      headers(creds),
      buildBody(req, false),
      signal,
    );
    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    return { text };
  },

  async chatStream(req, creds, onDelta, signal): Promise<void> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const res = await postForStream(
      'anthropic',
      `${base}/v1/messages`,
      headers(creds),
      buildBody(req, true),
      signal,
    );
    await readSSE(res, (data) => {
      try {
        const json = JSON.parse(data);
        if (json?.type === 'content_block_delta' && json?.delta?.type === 'text_delta') {
          onDelta(json.delta.text as string);
        }
      } catch {
        /* ignora */
      }
    });
  },
};
