import { postJson, postForStream, readSSE } from './http';
import type { ChatRequest, ChatResult, ProviderCredentials, ProviderId } from './types';

// Logica de chat compartilhada por providers compativeis com a API da OpenAI
// (OpenAI e OpenRouter). Fonte unica do mapeamento de mensagens/imagens.

interface OpenAiChatResponse {
  choices: Array<{ message?: { content?: string } }>;
}

/** Ajustes por modelo/gateway na hora de montar o corpo da requisicao. */
export interface OpenAiCompatOpts {
  /** Modelos atuais da OpenAI exigem max_completion_tokens (max_tokens da HTTP 400
   *  em o-series/gpt-5). O OpenRouter continua com max_tokens (padrao do gateway). */
  maxTokensParam?: 'max_tokens' | 'max_completion_tokens';
  /** Modelos de raciocinio (o-series/gpt-5) so aceitam a temperature padrao. */
  supportsTemperature?: boolean;
}

function buildBody(req: ChatRequest, stream: boolean, opts: OpenAiCompatOpts = {}) {
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
  const maxTokensParam = opts.maxTokensParam ?? 'max_tokens';
  return {
    model: req.model,
    messages,
    ...(opts.supportsTemperature === false ? {} : { temperature: req.temperature }),
    [maxTokensParam]: req.maxTokens,
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
  opts?: OpenAiCompatOpts,
): Promise<ChatResult> {
  const base = baseUrl.replace(/\/$/, '');
  const data = await postJson<OpenAiChatResponse>(
    providerId,
    `${base}/chat/completions`,
    { authorization: `Bearer ${creds.apiKey}`, ...extraHeaders },
    buildBody(req, false, opts),
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
  opts?: OpenAiCompatOpts,
): Promise<void> {
  const base = baseUrl.replace(/\/$/, '');
  const res = await postForStream(
    providerId,
    `${base}/chat/completions`,
    { authorization: `Bearer ${creds.apiKey}`, ...extraHeaders },
    buildBody(req, true, opts),
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
