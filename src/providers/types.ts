// Contrato unico da camada de IA. Todo provider implementa ProviderModule.
// Fonte da verdade: .claude/SDD/providers.md

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter';

export type Capability = 'chat' | 'transcribe' | 'vision' | 'embeddings' | 'search';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Imagens anexadas a ultima mensagem do usuario (para providers com 'vision'). */
  images?: ImageInput[];
  /** Habilita busca na web (para providers com 'search'). */
  search?: boolean;
}

export interface ChatResult {
  text: string;
}

export interface TranscribeRequest {
  model: string;
  /** Audio ja decriptado (blob do <audio> do WhatsApp) codificado em base64. */
  audioBase64: string;
  mimeType: string;
  /** Idioma esperado (ex.: "pt"), opcional. */
  language?: string;
  /** Dica de contexto para melhorar a transcricao, opcional. */
  prompt?: string;
}

export interface TranscribeResult {
  text: string;
}

export interface ProviderCredentials {
  apiKey: string;
  /** Sobrescreve o endpoint base (util para proxies / OpenRouter self-host). */
  baseUrl?: string;
}

export interface ProviderModule {
  id: ProviderId;
  label: string;
  capabilities: Capability[];
  /** Modelos padrao por tipo de tarefa. */
  defaultModels: {
    chat: string;
    transcribe?: string;
  };
  /** Sugestoes exibidas na UI (o usuario pode digitar qualquer modelo). */
  suggestedModels: {
    chat: string[];
    transcribe?: string[];
  };
  chat(
    req: ChatRequest,
    creds: ProviderCredentials,
    signal?: AbortSignal,
  ): Promise<ChatResult>;
  transcribe?(
    req: TranscribeRequest,
    creds: ProviderCredentials,
    signal?: AbortSignal,
  ): Promise<TranscribeResult>;
}

export function hasCapability(p: ProviderModule, cap: Capability): boolean {
  return p.capabilities.includes(cap);
}

/** Erro normalizado das chamadas aos providers, com mensagem legivel em pt-BR. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: ProviderId,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
