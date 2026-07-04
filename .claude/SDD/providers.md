# SDD — Provedores de IA

## Objetivo

Camada extensível que fala com múltiplos provedores de LLM por uma interface única, escondendo diferenças de endpoint/formato. Permitir escolher provedor + modelo por tarefa.

## Contrato

`ProviderModule` (em [`src/providers/types.ts`](../../src/providers/types.ts)):

- `id`, `label`, `capabilities` (`chat` | `transcribe` | `vision` | `embeddings`)
- `defaultModels.chat` / `.transcribe`
- `suggestedModels` (exibidos como `datalist`; o usuário pode digitar qualquer modelo)
- `chat(req, creds, signal)` → `{ text }`
- `transcribe?(req, creds, signal)` → `{ text }` (só quando `capabilities` inclui `transcribe`)

Erros normalizados em `ProviderError` com mensagem legível em pt-BR ([`src/providers/http.ts`](../../src/providers/http.ts) humaniza HTTP 401/403/429/etc.).

## Provedores implementados

| id | Chat | Transcrição | Busca web | Notas |
|----|------|-------------|-----------|-------|
| `anthropic` | `/v1/messages` | — | ✅ `web_search_20250305` | header `anthropic-dangerous-direct-browser-access: true`; `system` separado |
| `openai` | `/v1/chat/completions` | `/v1/audio/transcriptions` | — | também faz `vision` |
| `gemini` | `:generateContent` | `:generateContent` + `inline_data` | ✅ `google_search` | roles `user`/`model` |
| `openrouter` | `/api/v1/chat/completions` | — | — | compatível OpenAI; `HTTP-Referer`/`X-Title` |

Capacidades: `chat`, `transcribe`, `vision`, `search`. `ChatRequest` carrega `images` (vision) e `search` (busca web). O background aplica a config de geração (`maxTokens`, `temperature`, `rules`) — ver [`chat-panel.md`](./chat-panel.md).

Chat compatível com OpenAI é compartilhado em [`openai-compatible.ts`](../../src/providers/openai-compatible.ts) (reuso entre `openai` e `openrouter`).

## Registro (fonte única)

Todos os provedores entram em [`src/providers/registry.ts`](../../src/providers/registry.ts). `providersWith('transcribe')` lista os que transcrevem — a UI usa isso para só oferecer transcrição quando aplicável.

## Resolução por tarefa

[`src/ai/resolve.ts`](../../src/ai/resolve.ts): dada a config e a tarefa (`summarize`/`explain`/`suggest`/`transcribe`), escolhe:
1. Preferência explícita do usuário (`config.tasks[task]`), se o provedor estiver habilitado, com chave e capaz;
2. senão, o primeiro provedor habilitado, com chave e capaz;
3. senão, erro pt-BR orientando configurar nas Opções.

Modelo efetivo: `config.tasks[task].model` > `providerConfig.chatModel/transcribeModel` > `provider.defaultModels`.

## Segurança

- Chaves em `chrome.storage.local`; `fetch` só no background.
- `host_permissions` (em `wxt.config.ts`) cobrem os 4 domínios de API.

## Critérios de aceite

- "Testar conexão" (Opções) retorna OK para uma chave válida e mensagem clara para chave inválida.
- Adicionar um provedor novo exige mexer só em `src/providers/` + `registry.ts` + `host_permissions`.

## Como estender

Ver [`.claude/HARNESS/adicionar-provider.md`](../HARNESS/adicionar-provider.md).
