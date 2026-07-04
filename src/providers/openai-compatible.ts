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
  const lastUserIdx = req.messages.map((m) => m.role).lastIndexOf('user');
  const messages = req.messages.map((m, i) => {
    // Anexa imagens (data URI) na ultima mensagem do usuario, quando houver.
    if (i === lastUserIdx && req.images?.length) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content },
          ...req.images.map((img) => ({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
          })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  const data = await postJson<OpenAiChatResponse>(
    providerId,
    `${base}/chat/completions`,
    { authorization: `Bearer ${creds.apiKey}`, ...extraHeaders },
    {
      model: req.model,
      messages,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    },
    signal,
  );
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  return { text };
}
