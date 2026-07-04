# SDD — Painel-chat (follow-up, por conversa, geração)

## Objetivo

O painel de resultados é uma **conversa contínua**: depois de resumir/explicar/transcrever/descrever/pesquisar, o usuário pode continuar perguntando (mais contexto, detalhar, pesquisar online), com os controles de geração à mão. Cada conversa do WhatsApp tem o seu próprio painel.

## Modelo

`Session` (em [`actions.ts`](../../src/ui/content/actions.ts)):
- `thread: ChatMessage[]` — thread completo enviado à IA (system + contexto + turnos). Follow-up faz `thread.push(user)` → chama → `push(assistant)`.
- `display: Turn[]` — turnos visíveis (usuário/assistente).
- `task` — tarefa usada para resolver o provider nos follow-ups.
- `images?` — mantidas para follow-ups de imagem; `searchDefault?` — mantém busca; `suggestions?` — modo sugestão.

`startSession(seed)` chama a IA uma vez e devolve a sessão; `followUp(session, pergunta, useSearch)` estende.

## Por conversa

[`App.tsx`](../../src/ui/content/App.tsx) rastreia a conversa aberta por `readHeaderTitle()` (com `MutationObserver` + polling). `panels: Record<chatKey, PanelData>`. Ao trocar de conversa, o painel exibido troca (`panels[chatKey]`); fechar remove só o painel daquela conversa. Enquanto aberto, persiste até o usuário fechar.

## Geração (limites e regras)

Engrenagem no painel abre controles de `temperature`, `maxTokens` e `rules` (instruções personalizadas), persistidos em `config.generation` ([`storage.ts`](../../src/storage.ts)) e também editáveis nas Opções. O background aplica: `maxTokens` (padrão 2048 — evita respostas cortadas), `temperature` e injeta `rules` como um `system` extra em toda geração ([`background.ts`](../../entrypoints/background.ts)).

## Streaming e Markdown

- As ações de chat transmitem a resposta **ao vivo** (token a token) via `streamChat` (porta `wz-chat`) → `background` → `provider.chatStream` (SSE). `App.streamInto` atualiza o último turno conforme os deltas chegam. Sugerir/transcrever não usam streaming.
- Respostas do assistente são renderizadas como **Markdown** ([`Markdown.tsx`](../../src/ui/content/Markdown.tsx), `marked` + `dompurify`).

## UX

- Header: título + nome da conversa + engrenagem + fechar.
- Corpo: turnos (assistente/usuário) com "Copiar"; spinner ao gerar; erros em pt-BR.
- Rodapé: chip **Online** (liga busca web na resposta) + input de follow-up (Enter envia, Shift+Enter quebra linha).
- Overlay por CSS, sem travar o scroll; responsivo (`min(400px, 92vw)`).

## Critérios de aceite

- Resumir → perguntar "detalhe o item 2" continua no mesmo contexto.
- Trocar de conversa troca o painel; fechar não afeta as outras.
- Mudar limite/temperatura/regras reflete nas próximas respostas.
