# SDD — Resposta automática

> Status: **implementado** (3 modos, watcher, guard-rails). Direcionamento em grupo é heurístico (menção @) — refinar depois.

## Objetivo

Deixar a IA responder por você em grupo/PV quando fizer sentido, com controle total e mínimo risco de banimento.

## Modos (por conversa, padrão `off`) — `config.autoReply.byChat[chatKey]`

1. **Sugerir no painel** (`suggest`) — mostra a resposta num cartão flutuante com "Inserir"/"Ignorar".
2. **Rascunho** (`draft`) — `insertIntoComposer` no campo, **não envia**.
3. **Auto-enviar** (`autosend`) — `sendMessage` (insere + clica enviar). Exige aceitar o **modal de aviso de banimento** ao ativar.

Selecionável no menu do FAB ("Auto-resposta (esta conversa)").

## Gatilhos ([`src/wa/auto-reply.ts`](../../src/wa/auto-reply.ts))

- `MutationObserver` no `body` detecta a **última mensagem** nova; rebaseline ao trocar de conversa (não dispara no histórico).
- **PV**: qualquer mensagem recebida. **Grupo**: só quando `directed` (texto contém `@` — heurística de menção).
- A geração usa a tarefa `suggest` com `usePersona` (perfil injetado) e o prompt `buildAutoReplyPrompt`, que pode responder `[SKIP]` para não responder.

## Guard-rails

- Nunca responde à própria mensagem (`direction === 'out'`); **cooldown** de 8s entre disparos.
- **Kill-switch**: o interruptor mestre (`features.enabled`) desliga o watcher.
- Auto-envio só após aceitar o modal de aviso.

## Pendente

- Direcionamento em grupo mais preciso (reply à sua mensagem, nome do usuário).
- Indicador persistente de auto-envio ativo; limites por minuto.

## Critérios de aceite

- "Rascunho" num PV de teste gera rascunho no campo sem enviar.
- Auto-enviar exige aceite do aviso; o interruptor mestre interrompe na hora.
