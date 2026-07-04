# HARNESS — Adicionar um provedor de IA

Passos para plugar um provedor novo (ex.: Mistral, Groq, xAI). Fonte da verdade: [`../SDD/providers.md`](../SDD/providers.md).

1. **Criar** `src/providers/<id>.ts` exportando um `ProviderModule`:
   - `id`, `label`, `capabilities` (inclua `transcribe` só se realmente transcrever).
   - `defaultModels` e `suggestedModels`.
   - `chat(req, creds, signal)` — se a API for compatível com OpenAI, reuse `openAiCompatibleChat` de [`openai-compatible.ts`](../../src/providers/openai-compatible.ts).
   - `transcribe?` quando aplicável.
   - Use `postJson`/`postForm` de [`http.ts`](../../src/providers/http.ts) (erros já são humanizados).
2. **Adicionar o `id`** ao union `ProviderId` em [`types.ts`](../../src/providers/types.ts).
3. **Registrar** em [`registry.ts`](../../src/providers/registry.ts) (`PROVIDERS`).
4. **Liberar o host** em `wxt.config.ts` → `host_permissions` (`https://api.exemplo.com/*`).
5. **Rodar** `pnpm exec wxt prepare && pnpm compile`.
6. **Testar** nas Opções → "Testar conexão".

Não é preciso mexer na UI de Opções: ela itera `PROVIDER_IDS` automaticamente. Nada de credencial/host hardcoded fora desses pontos.
