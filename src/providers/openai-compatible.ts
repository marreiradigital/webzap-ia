import { postJson, postForStream, readSSE } from './http';
import type { ChatRequest, ChatResult, ProviderCredentials, ProviderId } from './types';

// Logica de chat compartilhada por providers compativeis com a API da OpenAI
// (OpenAI e OpenRouter). Fonte unica do mapeamento de mensagens/imagens.

interface OpenAiChatResponse {
  choices: Array<{ message?: { content?: string } }>;
}

function buildBody(req: ChatRequest, stream: boolean) {
  const lastUserIdx = req.messages.map((m) => m.role).lastIndexOf('user');
  const messages = req.messages.map((m, i) => {
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
  return {
    model: req.model,
    messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
    stream,
  };
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
    buildBody(req, false),
    signal,
  );
  return { text: (data.choices?.[0]?.message?.content ?? '').trim() };
}

export async function openAiCompatibleChatStream(
  providerId: ProviderId,
  baseUrl: string,
  req: ChatRequest,
  creds: ProviderCredentials,
  extraHeaders: Record<string, string>,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '');
  const res = await postForStream(
    providerId,
    `${base}/chat/completions`,
    { authorization: `Bearer ${creds.apiKey}`, ...extraHeaders },
    buildBody(req, true),
    signal,
  );
  await readSSE(res, (data) => {
    if (data === '[DONE]') return;
    try {
      const json = JSON.parse(data);
      const delta = json?.choices?.[0]?.delta?.content;
      if (delta) onDelta(delta);
    } catch {
      /* ignora linhas nao-JSON */
    }
  });
}
