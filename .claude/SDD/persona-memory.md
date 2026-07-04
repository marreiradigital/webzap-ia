# SDD — Persona & Memória

> Status: **implementado** — entrevista, memórias, injeção no sugerir e **auto-treino**.

## Objetivo

Dar à IA contexto persistente sobre o usuário — quem é, preferências, como responde — para que sugestões (e futuramente auto-respostas) soem como ele.

## Armazenamento

- **IndexedDB via Dexie** ([`src/memory/db.ts`](../../src/memory/db.ts)), 100% local, na **origem da extensão** — assim a página de memória (`chrome-extension://`) e o **background** compartilham o mesmo banco. O content script (origem `web.whatsapp.com`) não acessa direto: a recuperação acontece no background.
- Schema ([`schema.ts`](../../src/memory/schema.ts)): `Memory { type: persona|preference|style|contact, content, contact?, origin: manual|entrevista|auto-train, archived, timestamps }` + `InterviewTurn`.

## Página "Persona & Memória" (`entrypoints/memory/`)

- **Aba Entrevista** ([`interviewer.ts`](../../src/memory/interviewer.ts)): a IA faz uma pergunta por vez e, a cada resposta, uma chamada de extração devolve memórias em JSON, salvas (deduplicadas por conteúdo).
- **Aba Memórias**: lista por tipo, editar (blur salva), arquivar/reativar, apagar, adicionar manual.
- As chamadas de IA usam `raw: true` (ignoram as regras do usuário) para não sujar a extração.

## Recuperação (`retriever.ts`)

No background, para a tarefa `suggest` (e futura `autoReply`), `selectRelevant(memorias, {contact, query})` pontua por tipo + match de contato + keyword + recência e `personaSystemPrompt` monta o "perfil do usuário" injetado como `system` (top-N, prompt enxuto). Content passa `chatName` + `usePersona: true`. Embeddings ficam para depois.

## Auto-treinamento

- **Manual**: FAB → "Aprender desta conversa" (`actions.learnFromChat`) extrai memórias das mensagens do próprio usuário (`buildTrainingExtraction`) e salva via `memoryAdd` (background, origem `auto-train`, deduplicado).
- **Automático** (opt-in, `config.autoTrain`, padrão off): ao abrir uma conversa, aprende **uma vez por conversa** (throttle por sessão). Aviso de privacidade nas Opções (envia trechos ao provedor).
- O content não acessa o Dexie (origem diferente): a escrita passa pelo background via `memoryAdd`.

A persona já é injetada na **resposta automática** (usa a tarefa `suggest` com `usePersona`).

## Critérios de aceite

- Responder à entrevista cria memórias visíveis e editáveis na aba Memórias.
- "Sugerir resposta" reflete o perfil (tom/nome/preferências) quando há memórias.
