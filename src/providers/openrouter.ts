import { openAiCompatibleChat, openAiCompatibleChatStream } from './openai-compatible';
import type { ChatRequest, ChatResult, ProviderCredentials, ProviderModule } from './types';

const OR_HEADERS = { 'HTTP-Referer': 'https://web.whatsapp.com', 'X-Title': 'WebZap - IA' };

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

// OpenRouter: gateway compativel com a API da OpenAI (acesso a varios modelos com uma chave).
export const openrouter: ProviderModule = {
  id: 'openrouter',
  label: 'OpenRouter',
  capabilities: ['chat', 'vision'],
  defaultModels: {
    chat: 'openai/gpt-4o-mini',
  },
  suggestedModels: {
    chat: [
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },

  chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChat('openrouter', base, req, creds, OR_HEADERS, signal);
  },

  chatStream(req, creds, onDelta, signal) {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChatStream('openrouter', base, req, creds, OR_HEADERS, onDelta, signal);
  },
};
