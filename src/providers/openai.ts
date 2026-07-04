import { postForm, postJson } from './http';
import { openAiCompatibleChat, openAiCompatibleChatStream } from './openai-compatible';
import { base64ToBlob } from '@/src/lib/binary';
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

// OpenAI: chat (chat/completions) + transcricao de audio (audio/transcriptions).
export const openai: ProviderModule = {
  id: 'openai',
  label: 'OpenAI',
  capabilities: ['chat', 'transcribe', 'vision', 'embeddings'],
  defaultModels: {
    chat: 'gpt-4o',
    transcribe: 'gpt-4o-transcribe',
    embed: 'text-embedding-3-small',
  },
  suggestedModels: {
    chat: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    transcribe: ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
  },

  chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChat('openai', base, req, creds, {}, signal);
  },

  chatStream(req, creds, onDelta, signal) {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    return openAiCompatibleChatStream('openai', base, req, creds, {}, onDelta, signal);
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
