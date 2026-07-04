# SDD 00 — Visão geral

Spec Driven Development do **WebZap - IA**. Cada arquivo aqui é a fonte da verdade do "o quê" e do "porquê" de uma capacidade. O código referencia estas specs; ao mudar comportamento, atualize a spec na mesma entrega.

## Problema

Usar IA em conversas do WhatsApp hoje exige copiar texto para outra aba, colar, voltar. Queremos as ações mais úteis (resumir, explicar, transcrever, sugerir resposta) **dentro** do WhatsApp Web, com o provedor de IA que o usuário já paga.

## Princípios

1. **DOM only.** Lemos apenas o que está visível/rolado no chat aberto. Não injetamos hooks nos módulos internos do WhatsApp. Menor risco de bloqueio.
2. **Chaves seguras.** Toda chamada aos provedores acontece no service worker (background); as chaves ficam em `chrome.storage.local` e nunca no content script.
3. **Fonte única.** Seletores (`src/wa/selectors.ts`), provedores (`src/providers/registry.ts`), prompts (`src/ai/prompts.ts`), config (`src/storage.ts`). Sem duplicação.
4. **Opt-in para envio.** Na v1 nada é enviado automaticamente. Sugestões só são inseridas no campo para o usuário revisar.
5. **Qualidade de UI.** pt-BR acentuado, responsivo, dropdowns sem scroll-lock.

## Componentes e specs

| Área | Spec | Fase |
|------|------|------|
| Provedores de IA | [`providers.md`](./providers.md) | 1 |
| Camada DOM do WhatsApp | [`wa-dom-layer.md`](./wa-dom-layer.md) | 1 |
| Resumir conversa | [`summarize.md`](./summarize.md) | 1 |
| Ações por mensagem (explicar) | [`per-message-actions.md`](./per-message-actions.md) | 1 |
| Transcrição de áudio | [`audio-transcription.md`](./audio-transcription.md) | 1 |
| Sugestão de resposta | [`reply-suggestions.md`](./reply-suggestions.md) | 1 |
| Painel-chat (follow-up, por conversa, geração) | [`chat-panel.md`](./chat-panel.md) | 1 |
| Pesquisar online | [`search-online.md`](./search-online.md) | 1 |
| Resposta automática | [`auto-reply.md`](./auto-reply.md) | 2 |
| Persona & Memória | [`persona-memory.md`](./persona-memory.md) | 2 |

## Fluxo de dados (comum a todas as ações)

```
content (lê DOM via src/wa) → monta prompt (src/ai/prompts) →
callBackground (src/messaging) → background resolve provedor (src/ai/resolve) →
provider.chat()/transcribe() (src/providers) → texto → content renderiza no painel
```

## Critérios de aceite globais

- `pnpm compile` e `pnpm build` passam sem erros.
- Nenhuma chave de API aparece no content script nem em logs.
- A UI injetada não quebra o layout do WhatsApp e não causa "pulo" de tela.
- Textos visíveis ao usuário em pt-BR acentuado.
