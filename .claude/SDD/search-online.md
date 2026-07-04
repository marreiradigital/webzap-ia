# SDD — Pesquisar online

## Objetivo

Responder com informações atualizadas da web, a partir de uma mensagem ou do assunto da conversa, citando fontes.

## Provedores

Capability `search` (em [`registry`](../../src/providers/registry.ts)):
- **Anthropic**: server tool `web_search_20250305` (a API executa a busca e devolve o texto final).
- **Gemini**: grounding `google_search`.
- OpenAI/OpenRouter: sem busca nativa aqui (não têm a capability); a UI orienta usar Anthropic/Gemini.

`ChatRequest.search` liga a ferramenta no provedor. Resolução: tarefa `search` → capability `search` ([`resolve.ts`](../../src/ai/resolve.ts)).

## UX

- **Menu da mensagem**: "Pesquisar online" (`searchMessage`) pesquisa sobre aquela mensagem.
- **FAB**: "Pesquisar online" (`searchConversation`) pesquisa sobre o assunto da conversa visível.
- No painel-chat, o chip **Online** liga a busca em qualquer follow-up (usa a tarefa `search`).

## Critérios de aceite

- Com Anthropic ou Gemini configurado, "Pesquisar online" traz resposta atual com fontes.
- Sem provedor de busca → erro claro orientando configurar Anthropic/Gemini.
