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
};

export function resolveTask(config: WebzapConfig, task: TaskKind): ResolvedTask {
  const cap = CAP_BY_TASK[task];

  // 1) Preferencia explicita do usuario para a tarefa.
  const pref = config.tasks[task];
  if (pref) {
    const cfg = config.providers[pref.providerId];
    const provider = getProvider(pref.providerId);
    if (cfg?.enabled && cfg.apiKey && provider.capabilities.includes(cap)) {
      return {
        provider,
        model: pref.model || providerModel(provider, cfg, task),
        creds: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      };
    }
  }

  // 2) Primeiro provider habilitado, com chave e capaz da tarefa.
  for (const id of PROVIDER_IDS) {
    const cfg = config.providers[id];
    const provider = PROVIDERS[id];
    if (cfg?.enabled && cfg.apiKey && provider.capabilities.includes(cap)) {
      return {
        provider,
        model: providerModel(provider, cfg, task),
        creds: { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl },
      };
    }
  }

  throw new Error(humanizeNoProvider(task, cap));
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
  return `Nenhum provedor de IA configurado para "${task}". Adicione uma chave de API nas Opções da extensão.`;
}
