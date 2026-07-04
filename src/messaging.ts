import { browser } from '#imports';
import type { ChatMessage, ProviderId } from '@/src/providers/types';
import type { TaskKind } from '@/src/storage';

// Protocolo tipado content <-> background. Todo fetch aos providers acontece no
// background (service worker); o content nunca ve as chaves de API.

export type BgRequest =
  | {
      kind: 'chat';
      task: TaskKind;
      messages: ChatMessage[];
      maxTokens?: number;
      temperature?: number;
      /** Imagens anexadas (para "descrever imagem"); exige provider com vision. */
      images?: { base64: string; mimeType: string }[];
      /** Habilita busca na web (exige provider com 'search'). */
      search?: boolean;
      /** Nome do contato/grupo atual, para injetar memorias relevantes (persona). */
      chatName?: string;
      /** Injeta o perfil do usuario (memoria) como system. Usado em sugerir/auto-resposta. */
      usePersona?: boolean;
      /** Ignora as regras personalizadas (ex.: entrevista/extracao que precisam de saida crua). */
      raw?: boolean;
    }
  | {
      kind: 'transcribe';
      audioBase64: string;
      mimeType: string;
      /** Contexto opcional para melhorar a transcricao. */
      prompt?: string;
    }
  | { kind: 'testProvider'; providerId: ProviderId }
  | { kind: 'openOptions' }
  | { kind: 'openMemory' }
  | {
      kind: 'memoryAdd';
      memories: { type: 'persona' | 'preference' | 'style' | 'contact'; content: string; contact?: string }[];
    };

export type BgResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };

export type StreamChatInput = Omit<Extract<BgRequest, { kind: 'chat' }>, 'kind'>;

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (full: string) => void;
  onError: (error: string) => void;
}

/** Chat em streaming (escrita ao vivo) via porta. Retorna funcao para cancelar. */
export function streamChat(input: StreamChatInput, handlers: StreamHandlers): () => void {
  const port = browser.runtime.connect({ name: 'wz-chat' });
  const close = () => {
    try {
      port.disconnect();
    } catch {
      /* ja fechada */
    }
  };
  port.onMessage.addListener((m: { type: string; text?: string; error?: string }) => {
    if (m.type === 'delta') handlers.onDelta(m.text ?? '');
    else if (m.type === 'done') {
      handlers.onDone(m.text ?? '');
      close();
    } else if (m.type === 'error') {
      handlers.onError(m.error ?? 'Erro no streaming.');
      close();
    }
  });
  port.postMessage({ kind: 'chat', ...input });
  return close;
}

/** Chamada do content/UI para o background. Sempre resolve (erros viram ok:false). */
export async function callBackground(req: BgRequest): Promise<BgResponse> {
  try {
    const res = (await browser.runtime.sendMessage(req)) as BgResponse | undefined;
    if (!res) return { ok: false, error: 'Sem resposta do serviço de fundo.' };
    return res;
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? 'Falha ao chamar o background.' };
  }
}
