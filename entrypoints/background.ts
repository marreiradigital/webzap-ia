import { defineBackground, browser } from '#imports';
import { getConfig, type WebzapConfig } from '@/src/storage';
import { resolveChain, resolveEmbed, resolveTts, type ResolvedTask } from '@/src/ai/resolve';
import { getProvider } from '@/src/providers/registry';
import { ProviderError, type ChatRequest } from '@/src/providers/types';
import { activeMemories, addMemory, memoryExists } from '@/src/memory/db';
import { selectRelevant, selectRelevantSemantic, personaSystemPrompt } from '@/src/memory/retriever';
import type { BgRequest, BgResponse } from '@/src/messaging';

type ChatMsg = Extract<BgRequest, { kind: 'chat' }>;

// Service worker: unico ponto que faz fetch aos providers (guarda as chaves fora
// da pagina do WhatsApp). Recebe requisicoes tipadas (onMessage) e streaming (onConnect).
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: BgRequest): Promise<BgResponse> => {
    return handle(message).catch((err) => ({
      ok: false,
      error: err instanceof ProviderError ? err.message : (err as Error)?.message ?? 'Erro inesperado.',
    }));
  });

  // Streaming de chat via porta (escrita ao vivo, token a token).
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'wz-chat') return;
    // Se o content fechar a porta (painel fechado / aba morta), aborta o fetch
    // no provedor — sem isso a geracao continuava rodando e gastando tokens.
    const aborter = new AbortController();
    port.onDisconnect.addListener(() => aborter.abort());
    port.onMessage.addListener(async (msg: ChatMsg) => {
      let started = false; // ja emitimos algum delta?
      try {
        const config = await getConfig();
        const { chain, req } = await prepareChat(config, msg);
        let lastErr: unknown = null;
        for (const { provider, model, creds } of chain) {
          try {
            if (provider.chatStream) {
              let full = '';
              await provider.chatStream(
                { ...req, model },
                creds,
                (delta) => {
                  full += delta;
                  started = true;
                  safePost(port, { type: 'delta', text: delta });
                },
                aborter.signal,
              );
              safePost(port, { type: 'done', text: full });
            } else {
              // Sem streaming: envia a resposta inteira de uma vez.
              const { text } = await provider.chat({ ...req, model }, creds, aborter.signal);
              started = true;
              safePost(port, { type: 'delta', text });
              safePost(port, { type: 'done', text });
            }
            return; // sucesso — nao tenta as reservas
          } catch (err) {
            if ((err as Error)?.name === 'AbortError') return; // cancelado pelo usuario
            lastErr = err;
            // Failover: so faz sentido tentar a reserva se NADA foi transmitido
            // ainda (no meio do texto viraria resposta duplicada/misturada).
            if (started) break;
          }
        }
        throw lastErr ?? new Error('Nenhum provedor disponível.');
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        safePost(port, {
          type: 'error',
          error: err instanceof ProviderError ? err.message : (err as Error)?.message ?? 'Erro inesperado.',
        });
      }
    });
  });
});

function safePost(port: { postMessage: (msg: unknown) => void }, msg: unknown) {
  try {
    port.postMessage(msg);
  } catch {
    /* porta ja fechada */
  }
}

/** Monta a CADEIA de provedores (principal + reservas) e o ChatRequest final
 *  (persona, regras, limites) para uma msg de chat. O model e por provedor. */
async function prepareChat(
  config: WebzapConfig,
  msg: ChatMsg,
): Promise<{ chain: ResolvedTask[]; req: Omit<ChatRequest, 'model'> }> {
  let chain = resolveChain(config, msg.task);
  if (msg.images?.length) {
    chain = chain.filter((c) => c.provider.capabilities.includes('vision'));
    if (!chain.length) {
      throw new Error(
        'Nenhum provedor configurado suporta analisar imagens. Use OpenAI, Gemini, Anthropic ou um modelo com visão no OpenRouter.',
      );
    }
  }
  const gen = config.generation;
  let messages = msg.messages;
  if (msg.usePersona) {
    const persona = await retrievePersona(config, msg.chatName, lastUserText(msg.messages));
    if (persona) messages = [{ role: 'system', content: persona }, ...messages];
  }
  if (!msg.raw && gen.rules?.trim()) {
    messages = [{ role: 'system', content: gen.rules.trim() }, ...messages];
  }
  return {
    chain,
    req: {
      messages,
      maxTokens: Math.max(msg.maxTokens ?? 0, gen.maxTokens),
      temperature: msg.temperature ?? gen.temperature,
      images: msg.images,
      search: msg.search,
    },
  };
}

/** Tenta cada elo da cadeia ate um dar certo (failover). Aborto nao faz failover. */
async function withFailover<T>(
  chain: ResolvedTask[],
  fn: (entry: ResolvedTask) => Promise<T>,
): Promise<T> {
  let lastErr: unknown = null;
  for (const entry of chain) {
    try {
      return await fn(entry);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('Nenhum provedor disponível.');
}

async function handle(msg: BgRequest): Promise<BgResponse> {
  const config = await getConfig();

  switch (msg.kind) {
    case 'chat': {
      const { chain, req } = await prepareChat(config, msg);
      const { text } = await withFailover(chain, ({ provider, model, creds }) =>
        provider.chat({ ...req, model }, creds),
      );
      return { ok: true, text };
    }

    case 'transcribe': {
      const chain = resolveChain(config, 'transcribe').filter((c) => c.provider.transcribe);
      if (!chain.length) {
        return { ok: false, error: 'Nenhum provedor de transcrição configurado. Configure OpenAI ou Gemini nas Opções.' };
      }
      const { text } = await withFailover(chain, ({ provider, model, creds }) =>
        provider.transcribe!(
          {
            model,
            audioBase64: msg.audioBase64,
            mimeType: msg.mimeType,
            language: config.language.toLowerCase().startsWith('pt') ? 'pt' : undefined,
            prompt: msg.prompt,
          },
          creds,
        ),
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
          // Modelos de raciocinio gastam tokens "pensando" antes de responder;
          // 8 tokens davam resposta vazia/erro no teste.
          maxTokens: 128,
        },
        { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      );
      return { ok: true, text: text || 'ok' };
    }

    case 'openOptions': {
      await browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
      return { ok: true, text: '' };
    }

    case 'openMemory': {
      await browser.tabs.create({ url: browser.runtime.getURL('/memory.html') });
      return { ok: true, text: '' };
    }

    case 'memoryAdd': {
      // Salva memorias (auto-treino) deduplicando por conteudo, com embedding.
      const toSave = [];
      for (const m of msg.memories) {
        if (m.content && !(await memoryExists(m.content))) toSave.push(m);
      }
      let embeddings: number[][] | null = null;
      const e = resolveEmbed(config);
      if (e?.provider.embed && toSave.length) {
        try {
          embeddings = await e.provider.embed(toSave.map((m) => m.content), e.model, e.creds);
        } catch {
          embeddings = null;
        }
      }
      for (let i = 0; i < toSave.length; i++) {
        const m = toSave[i];
        await addMemory({
          type: m.type,
          content: m.content,
          contact: m.contact,
          origin: 'auto-train',
          embedding: embeddings?.[i],
        });
      }
      return { ok: true, text: String(toSave.length) };
    }

    case 'embed': {
      const e = resolveEmbed(config);
      if (!e?.provider.embed) {
        return { ok: false, error: 'Nenhum provedor de embeddings configurado (OpenAI ou Gemini).' };
      }
      const vectors = await e.provider.embed(msg.texts, e.model, e.creds);
      return { ok: true, text: '', vectors };
    }

    case 'tts': {
      const t = resolveTts(config);
      if (!t?.provider.speak) {
        return { ok: false, error: 'Nenhum provedor de voz (TTS) configurado. Configure OpenAI.' };
      }
      const audio = await t.provider.speak(msg.text, t.model, t.creds);
      return { ok: true, text: '', audio };
    }

    default:
      return { ok: false, error: 'Requisição desconhecida.' };
  }
}

function lastUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

/** Recupera o perfil (persona) — semantico se houver embeddings, senao keyword. */
async function retrievePersona(
  config: WebzapConfig,
  chatName: string | undefined,
  query: string,
): Promise<string | null> {
  const mems = await activeMemories();
  if (!mems.length) return null;
  let selected = null as ReturnType<typeof selectRelevant> | null;
  if (query.trim() && mems.some((m) => m.embedding?.length)) {
    const vec = await tryEmbed(config, query);
    if (vec) selected = selectRelevantSemantic(mems, vec, { contact: chatName });
  }
  if (!selected) selected = selectRelevant(mems, { contact: chatName, query });
  return personaSystemPrompt(selected);
}

async function tryEmbed(config: WebzapConfig, text: string): Promise<number[] | null> {
  try {
    const e = resolveEmbed(config);
    if (!e?.provider.embed) return null;
    const vecs = await e.provider.embed([text], e.model, e.creds);
    return vecs[0] ?? null;
  } catch {
    return null;
  }
}
