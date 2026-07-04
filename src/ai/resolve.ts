import { getProvider, PROVIDER_IDS, PROVIDERS } from '@/src/providers/registry';
import type {
  Capability,
  ProviderCredentials,
  ProviderModule,
} from '@/src/providers/types';
import type { TaskKind, WebzapConfig } from '@/src/storage';

// Resolve qual provider + modelo usar para uma tarefa, lendo a config.
// Roda no background (tem acesso as chaves). Fonte unica da selecao.

export interface ResolvedTask {
  provider: ProviderModule;
  model: string;
  creds: ProviderCredentials;
}

const CAP_BY_TASK: Record<TaskKind, Capability> = {
  summarize: 'chat',
  explain: 'chat',
  suggest: 'chat',
  transcribe: 'transcribe',
  search: 'search',
};

/** Provedores APTOS (habilitados + com chave) na ordem de prioridade configurada:
 *  principal primeiro, depois as reservas; aptos fora da lista entram no final,
 *  na ordem do registry. FONTE UNICA da ordem de failover. */
export function eligibleProviders(config: WebzapConfig): ProviderModule[] {
  const orderedIds = [
    ...config.providerOrder.filter((id) => id in PROVIDERS),
    ...PROVIDER_IDS.filter((id) => !config.providerOrder.includes(id)),
  ];
  return orderedIds
    .map((id) => PROVIDERS[id])
    .filter((p) => {
      const cfg = config.providers[p.id];
      return !!cfg?.enabled && !!cfg.apiKey;
    });
}

function toResolved(
  provider: ProviderModule,
  config: WebzapConfig,
  task: TaskKind,
  modelOverride?: string,
): ResolvedTask {
  const cfg = config.providers[provider.id]!;
  return {
    provider,
    model: modelOverride || providerModel(provider, cfg, task),
    creds: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
  };
}

/** Cadeia de failover para a tarefa: [preferido/principal, reserva 1, ...].
 *  O override por tarefa (config.tasks) vem primeiro; o resto segue a ordem
 *  de prioridade. Lanca erro legivel se nenhum provedor servir. */
export function resolveChain(config: WebzapConfig, task: TaskKind): ResolvedTask[] {
  const cap = CAP_BY_TASK[task];
  const chain: ResolvedTask[] = [];

  const pref = config.tasks[task];
  if (pref && pref.providerId in PROVIDERS) {
    const cfg = config.providers[pref.providerId];
    const provider = getProvider(pref.providerId);
    if (cfg?.enabled && cfg.apiKey && provider.capabilities.includes(cap)) {
      chain.push(toResolved(provider, config, task, pref.model));
    }
  }

  for (const provider of eligibleProviders(config)) {
    if (!provider.capabilities.includes(cap)) continue;
    if (chain.some((c) => c.provider.id === provider.id)) continue;
    chain.push(toResolved(provider, config, task));
  }

  if (!chain.length) throw new Error(humanizeNoProvider(task, cap));
  return chain;
}

export function resolveTask(config: WebzapConfig, task: TaskKind): ResolvedTask {
  return resolveChain(config, task)[0];
}

/** Primeiro provider com embeddings na ordem de prioridade (ou null). */
export function resolveEmbed(config: WebzapConfig): ResolvedTask | null {
  for (const provider of eligibleProviders(config)) {
    if (provider.capabilities.includes('embeddings') && provider.embed) {
      const cfg = config.providers[provider.id]!;
      return {
        provider,
        model: provider.defaultModels.embed ?? '',
        creds: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      };
    }
  }
  return null;
}

/** Primeiro provider com TTS (sintese de voz) na ordem de prioridade (ou null). */
export function resolveTts(config: WebzapConfig): ResolvedTask | null {
  for (const provider of eligibleProviders(config)) {
    if (provider.capabilities.includes('tts') && provider.speak) {
      const cfg = config.providers[provider.id]!;
      return {
        provider,
        model: provider.defaultModels.tts ?? '',
        creds: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      };
    }
  }
  return null;
}

/** Modelo efetivo: override do provider (config) > default do codigo. */
function providerModel(
  provider: ProviderModule,
  cfg: { chatModel?: string; transcribeModel?: string },
  task: TaskKind,
): string {
  if (task === 'transcribe') {
    return (
      cfg.transcribeModel ||
      provider.defaultModels.transcribe ||
      provider.defaultModels.chat
    );
  }
  return cfg.chatModel || provider.defaultModels.chat;
}

function humanizeNoProvider(task: TaskKind, cap: Capability): string {
  if (cap === 'transcribe') {
    return 'Nenhum provedor de transcrição configurado. Configure OpenAI ou Gemini nas Opções da extensão.';
  }
  if (cap === 'search') {
    return 'Nenhum provedor de busca online configurado. Configure Anthropic ou Gemini nas Opções da extensão.';
  }
  return `Nenhum provedor de IA configurado para "${task}". Adicione uma chave de API nas Opções da extensão.`;
}
