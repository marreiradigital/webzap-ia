# SDD — Persona & Memória (Fase 2)

> Status: **planejado** (não implementado na v1). Este documento é o design.

## Objetivo

Dar à IA contexto persistente sobre o usuário — quem é, preferências, como responde — para que sugestões e auto-respostas soem como ele. Inclui auto-treinamento a partir das próprias conversas.

## Armazenamento

- **IndexedDB via Dexie** (`src/memory/db.ts`), 100% local. `db.ts` isola o Dexie atrás de uma interface para permitir trocar por SQLite-WASM no futuro.
- Schema (`schema.ts`): `PersonaFact`, `Preference`, `ContactNote`, `StyleSample`, `MemoryEmbedding`, `Interview`. Cada memória tem `origin` (`manual`/`entrevista`/`auto-train`), timestamp e flag ativa/arquivada.

## Página "Persona & Memória" (`entrypoints/memory/`)

- **Chat de entrevista** (`interviewer.ts`): a IA faz perguntas e, a cada resposta, extrai e salva memórias estruturadas. Onboarding + conversa contínua para ensinar mais.
- **Gestão de memórias**: lista pesquisável, editar/apagar/arquivar, agrupada por tipo e por contato/grupo. Transparência e controle total.

## Recuperação (`retriever.ts`)

Ao gerar sugestão/auto-resposta, seleciona as memórias mais relevantes ao chat atual (contato/grupo + semântica/keyword + recência) e injeta no prompt como "perfil do usuário + como ele responde". Mantém o prompt enxuto (top-N). Com provedor de embeddings (OpenAI/Gemini), usa vetor; senão, keyword+recência.

## Auto-treinamento (`auto-train.ts`, opt-in)

Extrai fatos e amostras de estilo das mensagens **do próprio usuário** e grava como memórias `auto-train`, deduplicadas contra as existentes. Controles: liga/desliga global e por chat, "esquecer este chat", revisão. **Aviso claro**: envia trechos das conversas ao provedor configurado; desligado por padrão.

## Critérios de aceite

- Responder à entrevista cria memórias visíveis e editáveis.
- Ligar auto-treino num chat de teste gera memórias `auto-train` deduplicadas.
- As respostas geradas melhoram ao incorporar a memória do contato/grupo.
