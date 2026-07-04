import { anthropic } from './anthropic';
import { openai } from './openai';
import { gemini } from './gemini';
import { openrouter } from './openrouter';
import type { Capability, ProviderId, ProviderModule } from './types';

// Fonte unica de providers. Para adicionar um novo provider: implemente o
// ProviderModule e registre-o AQUI (e nada mais espalhado pelo codigo).
export const PROVIDERS: Record<ProviderId, ProviderModule> = {
  anthropic,
  openai,
  gemini,
  openrouter,
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function getProvider(id: ProviderId): ProviderModule {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Provider desconhecido: ${id}`);
  return p;
}

/** Providers que suportam uma capacidade (ex.: quais transcrevem audio). */
export function providersWith(cap: Capability): ProviderModule[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter((p) =>
    p.capabilities.includes(cap),
  );
}
