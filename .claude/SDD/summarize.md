# SDD — Resumir conversa

## Objetivo

Resumir a conversa **visível** (grupo ou PV) em 3 níveis de detalhe, sem sair do WhatsApp.

## UX

- Botão flutuante "Zap" (canto inferior direito) → menu: **Resumo curto**, **Resumir conversa** (médio), **Resumo detalhado**.
- Resultado num painel lateral (overlay por CSS, não trava o scroll), com botão **Copiar**.
- Estado de carregamento com spinner; erros em pt-BR no próprio painel.

## Implementação

- `src/ui/content/actions.ts#summarize(length)`: `readVisibleChat()` → `buildSummaryPrompt(ctx, length)` → `callBackground({kind:'chat', task:'summarize'})`.
- Prompt em `src/ai/prompts.ts#buildSummaryPrompt`: instrui bullets, separa "Pendências", proíbe inventar dados, força pt-BR.
- `maxTokens`: 800 (curto/médio) / 1600 (detalhado).

## Regras

- Se não houver mensagens visíveis → erro orientando abrir a conversa e rolar.
- Detecta grupo vs PV para ajustar o texto do prompt.

## Critérios de aceite

- Num grupo com histórico visível, o resumo reflete os tópicos reais e lista pendências quando existem.
- Trocar o nível muda o tamanho/detalhe do resultado.
