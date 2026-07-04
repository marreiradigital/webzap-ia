import { postForm, postJson } from './http';
import { openAiCompatibleChat, openAiCompatibleChatStream } from './openai-compatible';
import { base64ToBlob, arrayBufferToBase64 } from '@/src/lib/binary';
import { ProviderError } from './types';
import type {
  ChatRequest,
  ChatResult,
  ProviderCredentials,
  ProviderModule,
  TranscribeRequest,
  TranscribeResult,
} from './types';

const DEFAULT_BASE = 'https://api.openai.com/v1';

interface OpenAiTranscription {
  text: string;
}

/** Modelos de raciocinio (o-series, gpt-5) rejeitam temperature customizada. */
function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model);
}

/** A API atual da OpenAI exige max_completion_tokens (max_tokens da HTTP 400 nos
 *  modelos novos); temperature so vai quando o modelo aceita. */
function compatOpts(model: string) {
  return {
    maxTokensParam: 'max_completion_tokens' as const,
    supportsTemperature: !isReasoningModel(model),
  };
}

// OpenAI: chat (chat/completions) + transcricao de audio (audio/transcriptions).
export const openai: ProviderModule = {
  id: 'openai',
  label: 'OpenAI',
  capabilities: ['chat', 'transcribe', 'vision', 'embeddings', 'tts'],
  defaultModels: {
    chat: 'gpt-4o',
    transcribe: 'gpt-4o-transcribe',
    embed: 'text-embedding-3-small',
    tts: 'gpt-4o-mini-tts',
  },
  suggestedModels: {
    chat: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    transcribe: ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
  },

  chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChat('openai', base, req, creds, {}, signal, compatOpts(req.model));
  },

  chatStream(req, creds, onDelta, signal) {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChatStream('openai', base, req, creds, {}, onDelta, signal, compatOpts(req.model));
  },

  async speak(text, model, creds, signal): Promise<{ base64: string; mimeType: string }> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const res = await fetch(`${base}/audio/speech`, {
      method: 'POST',
      headers: { authorization: `Bearer ${creds.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, voice: 'alloy', input: text, response_format: 'mp3' }),
      signal,
    });
    if (!res.ok) {
      throw new ProviderError(
        `Erro do OpenAI ao gerar audio (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`,
        'openai',
        res.status,
      );
    }
    const buf = await res.arrayBuffer();
    return { base64: arrayBufferToBase64(buf), mimeType: 'audio/mpeg' };
  },

  async embed(texts, model, creds, signal): Promise<number[][]> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const data = await postJson<{ data: Array<{ embedding: number[] }> }>(
      'openai',
      `${base}/embeddings`,
      { authorization: `Bearer ${creds.apiKey}` },
      { model, input: texts },
      signal,
    );
    return data.data.map((d) => d.embedding);
  },

  async transcribe(
    req: TranscribeRequest,
    creds: ProviderCredentials,
    signal,
  ): Promise<TranscribeResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const blob = base64ToBlob(req.audioBase64, req.mimeType);
    const form = new FormData();
    form.append('file', blob, fileName(req.mimeType));
    form.append('model', req.model);
    if (req.language) form.append('language', req.language);
    if (req.prompt) form.append('prompt', req.prompt);

    const data = await postForm<OpenAiTranscription>(
      'openai',
      `${base}/audio/transcriptions`,
      { authorization: `Bearer ${creds.apiKey}` },
      form,
      signal,
    );
    return { text: (data.text ?? '').trim() };
  },
};

function fileName(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'audio.ogg';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3';
  if (mimeType.includes('wav')) return 'audio.wav';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a';
  return 'audio.ogg';
}
