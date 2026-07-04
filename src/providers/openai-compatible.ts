import { postJson } from './http';
import type { ChatRequest, ChatResult, ProviderCredentials, ProviderId } from './types';

// Logica de chat compartilhada por providers compativeis com a API da OpenAI
// (OpenAI e OpenRouter). Fonte unica para nao duplicar o mapeamento de mensagens.

interface OpenAiChatResponse {
  choices: Array<{ message?: { content?: string } }>;
}

export async function openAiCompatibleChat(
  providerId: ProviderId,
  baseUrl: string,
  req: ChatRequest,
  creds: ProviderCredentials,
  extraHeaders: Record<string, string>,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const base = baseUrl.replace(/\/$/, '');
  const data = await postJson<OpenAiChatResponse>(
    providerId,
    `${base}/chat/completions`,
    { authorization: `Bearer ${creds.apiKey}`, ...extraHeaders },
    {
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    },
    signal,
  );
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  return { text };
}
