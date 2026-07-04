import { postJson } from './http';
import type {
  ChatRequest,
  ChatResult,
  ProviderCredentials,
  ProviderModule,
  TranscribeRequest,
  TranscribeResult,
} from './types';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

// Google Gemini: chat + transcricao de audio (audio inline num unico endpoint generateContent).
export const gemini: ProviderModule = {
  id: 'gemini',
  label: 'Google Gemini',
  capabilities: ['chat', 'transcribe', 'vision', 'search'],
  defaultModels: {
    chat: 'gemini-2.5-flash',
    transcribe: 'gemini-2.5-flash',
  },
  suggestedModels: {
    chat: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    transcribe: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },

  async chat(req: ChatRequest, creds: ProviderCredentials, signal): Promise<ChatResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const system = req.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const turns = req.messages.filter((m) => m.role !== 'system');
    const lastUserIdx = turns.map((m) => m.role).lastIndexOf('user');
    const contents = turns.map((m, i) => {
      const parts: Array<Record<string, unknown>> = [{ text: m.content }];
      // Anexa imagens (base64 inline) na ultima mensagem do usuario.
      if (i === lastUserIdx && req.images?.length) {
        for (const img of req.images) {
          parts.unshift({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

    const data = await postJson<GeminiResponse>(
      'gemini',
      `${base}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(creds.apiKey)}`,
      {},
      {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        // Grounding com Google Search quando a busca online esta habilitada.
        ...(req.search ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
        },
      },
      signal,
    );
    return { text: extractText(data) };
  },

  async transcribe(
    req: TranscribeRequest,
    creds: ProviderCredentials,
    signal,
  ): Promise<TranscribeResult> {
    const base = creds.baseUrl?.replace(/\/$/, '') ?? DEFAULT_BASE;
    const instruction = req.prompt
      ? `Transcreva o audio a seguir em ${req.language ?? 'portugues do Brasil'}. Contexto: ${req.prompt}. Responda apenas com a transcricao, sem comentarios.`
      : `Transcreva o audio a seguir em ${req.language ?? 'portugues do Brasil'}. Responda apenas com a transcricao, sem comentarios.`;

    const data = await postJson<GeminiResponse>(
      'gemini',
      `${base}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(creds.apiKey)}`,
      {},
      {
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: req.mimeType, data: req.audioBase64 } },
              { text: instruction },
            ],
          },
        ],
      },
      signal,
    );
    return { text: extractText(data) };
  },
};

function extractText(data: GeminiResponse): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();
}
