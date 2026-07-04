# SDD — Sugestão de resposta

## Objetivo

Gerar de 2 a 3 sugestões de resposta a partir da conversa visível e permitir inserir a escolhida no campo — **sem enviar**.

## UX

- Botão flutuante "Zap" → **Sugerir resposta**.
- Painel lateral lista as sugestões como botões clicáveis.
- Clicar numa sugestão a insere no campo de digitação (o usuário revisa e envia). Toast confirma.
- Aviso no painel: "Nada é enviado sem você".

## Implementação

- `actions.ts#suggest()`: `readVisibleChat()` → `buildSuggestPrompt(ctx)` → `callBackground({kind:'chat', task:'suggest', temperature:0.7})`.
- Parsing: quebra por linha, remove marcadores/numeração, pega até 3.
- Inserção: `src/wa/composer.ts#insertIntoComposer` (foco + `execCommand('insertText')`, com fallback de `InputEvent`). **Não** clica em enviar.

## Decisões

- `temperature` mais alta (0.7) para variedade.
- Base para a Fase 2 (auto-reply reutiliza o prompt/estilo). Ver [`auto-reply.md`](./auto-reply.md) e [`persona-memory.md`](./persona-memory.md).

## Critérios de aceite

- Gera sugestões coerentes com a conversa, em pt-BR, no tom de quem responde.
- Clicar insere no campo e nada é enviado automaticamente.
