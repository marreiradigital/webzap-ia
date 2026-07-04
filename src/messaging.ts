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
    }
  | {
      kind: 'transcribe';
      audioBase64: string;
      mimeType: string;
      /** Contexto opcional para melhorar a transcricao. */
      prompt?: string;
    }
  | { kind: 'testProvider'; providerId: ProviderId }
  | { kind: 'openOptions' };

export type BgResponse =
  | { ok: true; text: string }
  | { ok: false; error: string };

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
