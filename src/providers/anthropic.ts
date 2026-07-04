import { postJson } from './http';
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

// Anthropic Messages API. Nao faz transcricao de audio (sem capability 'transcribe').
export const anthropic: ProviderModule = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  capabilities: ['chat', 'vision'],
  defaultModels: {
    chat: 'claude-sonnet-5',
  },
  suggestedModels: {
    chat: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  },

  async chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    // Anthropic separa o system dos turnos user/assistant.
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const data = await postJson<AnthropicResponse>(
      'anthropic',
      `${base}/v1/messages`,
      {
        'x-api-key': creds.apiKey,
        'anthropic-version': API_VERSION,
        // Necessario para chamar a API direto do navegador/extensao.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      {
        model: req.model,
        max_tokens: req.maxTokens ?? 1024,
        temperature: req.temperature,
        ...(system ? { system } : {}),
        messages,
      },
      signal,
    );

    const text = data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();
    return { text };
  },
};
