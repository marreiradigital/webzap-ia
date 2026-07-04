import { defineBackground, browser } from '#imports';
import { getConfig } from '@/src/storage';
import { resolveTask } from '@/src/ai/resolve';
import { getProvider } from '@/src/providers/registry';
import { ProviderError } from '@/src/providers/types';
import type { BgRequest, BgResponse } from '@/src/messaging';

// Service worker: unico ponto que faz fetch aos providers (guarda as chaves fora
// da pagina do WhatsApp). Recebe requisicoes tipadas do content/UI.
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BgRequest): Promise<BgResponse> => {
    return handle(message).catch((err) => ({
      ok: false,
      error: err instanceof ProviderError ? err.message : (err as Error)?.message ?? 'Erro inesperado.',
    }));
  });
});

async function handle(msg: BgRequest): Promise<BgResponse> {
  const config = await getConfig();

  switch (msg.kind) {
    case 'chat': {
      const { provider, model, creds } = resolveTask(config, msg.task);
      const { text } = await provider.chat(
        {
          model,
          messages: msg.messages,
          maxTokens: msg.maxTokens ?? 1024,
          temperature: msg.temperature,
        },
        creds,
      );
      return { ok: true, text };
    }

    case 'transcribe': {
      const { provider, model, creds } = resolveTask(config, 'transcribe');
      if (!provider.transcribe) {
        return { ok: false, error: `${provider.label} não suporta transcrição de áudio.` };
      }
      const { text } = await provider.transcribe(
        {
          model,
          audioBase64: msg.audioBase64,
          mimeType: msg.mimeType,
          language: config.language.toLowerCase().startsWith('pt') ? 'pt' : undefined,
          prompt: msg.prompt,
        },
        creds,
      );
      return { ok: true, text };
    }

    case 'testProvider': {
      const cfg = config.providers[msg.providerId];
      if (!cfg?.apiKey) {
        return { ok: false, error: 'Sem chave de API configurada para este provedor.' };
      }
      const provider = getProvider(msg.providerId);
      const { text } = await provider.chat(
        {
          model: cfg.chatModel || provider.defaultModels.chat,
          messages: [{ role: 'user', content: 'Responda apenas com: ok' }],
          maxTokens: 8,
        },
        { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      );
      return { ok: true, text: text || 'ok' };
    }

    case 'openOptions': {
      // Abre numa aba inteira (melhor para o formulario de configuracao).
      await browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
      return { ok: true, text: '' };
    }

    default:
      return { ok: false, error: 'Requisição desconhecida.' };
  }
}
