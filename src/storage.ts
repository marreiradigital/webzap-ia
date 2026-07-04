import { storage } from '#imports';
import type { ProviderId } from '@/src/providers/types';

// Estado/config persistidos (chrome.storage.local). Fonte unica da configuracao.
// As chaves de API ficam AQUI (storage.local), nunca no content script da pagina.

/** Tarefas de IA que podem mapear provider + modelo independentes. */
export type TaskKind = 'summarize' | 'explain' | 'suggest' | 'transcribe' | 'search';

export interface TaskModel {
  providerId: ProviderId;
  model: string;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  /** Modelo de chat padrao deste provider (sobrescreve o default do codigo). */
  chatModel?: string;
  /** Modelo de transcricao padrao deste provider. */
  transcribeModel?: string;
}

export interface FeatureToggles {
  /** Interruptor mestre: desliga toda a UI injetada. */
  enabled: boolean;
  summarize: boolean;
  perMessage: boolean;
  transcribe: boolean;
  suggest: boolean;
}

export interface GenerationSettings {
  /** Limite de tokens da resposta (evita respostas cortadas). */
  maxTokens: number;
  /** Criatividade (0 = objetivo, 1 = criativo). */
  temperature: number;
  /** Regras/instrucoes personalizadas, aplicadas como system em toda geracao. */
  rules: string;
}

/** Modo de resposta automatica por conversa. */
export type AutoReplyMode = 'off' | 'suggest' | 'draft' | 'autosend';

export interface AutoReplySettings {
  /** Modo por conversa (chave = nome do chat). Ausente = 'off'. */
  byChat: Record<string, AutoReplyMode>;
  /** Palavras que contam como "direcionado a mim" em grupo (nome/apelidos), alem de @. Separadas por virgula. */
  mentions: string;
}

export interface WebzapConfig {
  providers: Partial<Record<ProviderId, ProviderConfig>>;
  /** provider + modelo por tarefa. Ausente => usa o primeiro provider apto. */
  tasks: Partial<Record<TaskKind, TaskModel>>;
  /** Idioma preferido das respostas/transcricoes. */
  language: string;
  features: FeatureToggles;
  generation: GenerationSettings;
  autoReply: AutoReplySettings;
  /** Auto-treinamento: aprender memorias das conversas automaticamente (opt-in). */
  autoTrain: boolean;
}

export const DEFAULT_CONFIG: WebzapConfig = {
  providers: {},
  tasks: {},
  language: 'pt-BR',
  features: {
    enabled: true,
    summarize: true,
    perMessage: true,
    transcribe: true,
    suggest: true,
  },
  generation: {
    maxTokens: 2048,
    temperature: 0.6,
    rules: '',
  },
  autoReply: { byChat: {}, mentions: '' },
  autoTrain: false,
};

export const configItem = storage.defineItem<WebzapConfig>('local:webzap-config', {
  fallback: DEFAULT_CONFIG,
  version: 1,
});

export async function getConfig(): Promise<WebzapConfig> {
  const raw = await configItem.getValue();
  // Merge defensivo com defaults (protege contra config antiga / parcial).
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    features: { ...DEFAULT_CONFIG.features, ...raw?.features },
    generation: { ...DEFAULT_CONFIG.generation, ...raw?.generation },
    autoReply: { byChat: { ...raw?.autoReply?.byChat }, mentions: raw?.autoReply?.mentions ?? '' },
    autoTrain: raw?.autoTrain ?? false,
    providers: { ...raw?.providers },
    tasks: { ...raw?.tasks },
  };
}

export async function setConfig(config: WebzapConfig): Promise<void> {
  await configItem.setValue(config);
}

export async function updateConfig(
  patch: (current: WebzapConfig) => WebzapConfig,
): Promise<WebzapConfig> {
  const current = await getConfig();
  const next = patch(current);
  await setConfig(next);
  return next;
}

/** Observa mudancas de config (usado pela UI injetada para reagir a toggles). */
export function watchConfig(cb: (config: WebzapConfig) => void): () => void {
  return configItem.watch((value) => cb({ ...DEFAULT_CONFIG, ...value }));
}
