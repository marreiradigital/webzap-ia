# SDD — Camada DOM do WhatsApp

## Objetivo

Ler a conversa visível do WhatsApp Web e localizar nós de mensagem/áudio, isolando toda dependência do DOM (obfuscado e instável) em poucos arquivos.

## Arquivos

- [`selectors.ts`](../../src/wa/selectors.ts) — **fonte única** de seletores, cada campo com fallbacks; helper `firstMatch`.
- [`message-nodes.ts`](../../src/wa/message-nodes.ts) — `getMessageRows`, `parseRow` (autor/texto/timestamp/direção/tipo), `contextWindow`.
- [`chat-reader.ts`](../../src/wa/chat-reader.ts) — `readVisibleChat()` → `ChatContext` (nome, isGroup, mensagens); `readHeaderTitle()`.
- [`audio.ts`](../../src/wa/audio.ts) — `extractAudio(row)` e `extractImage(row)` (fetch do `blob:` já decriptado → base64), `hasAudio(row)`.
- Descriminação de mídia: `detectKind(el)` em `message-nodes.ts` classifica `text | audio | image | video | document`.
- [`composer.ts`](../../src/wa/composer.ts) — `insertIntoComposer(text)` (não envia).
- [`types.ts`](../../src/wa/types.ts) — `WaMessage`, `ChatContext`.

## Decisões

- **Leitura em 3 estratégias** (`collectMessages`): 1) blocos `[data-pre-plain-text]` (o mais estável); 2) `div[role="row"]`; 3) qualquer `.selectable-text`. Não força scroll nem carrega histórico — o usuário rola o quanto quiser antes de acionar. Ancorar em `data-pre-plain-text`/`.selectable-text` (estáveis há anos) é mais robusto que depender de `.message-in/.message-out`.
- **Autor/timestamp** vêm do atributo `data-pre-plain-text` (`"[HH:MM, DD/MM/AAAA] Autor: "`).
- **Direção** por `.message-in` / `.message-out`.
- **Grupo vs PV**: heurística = mais de um autor distinto entre as mensagens recebidas. Simples e suficiente para o prompt; não depende de seletor frágil de subtítulo.
- **Áudio decriptado de graça**: o `<audio>` do WhatsApp aponta para um `blob:` local já decriptado; `fetch(blobUrl)` devolve os bytes. Se o blob ainda não existe, pedir ao usuário para tocar o play uma vez.

## Fragilidade e manutenção

Seletores quebram quando o WhatsApp muda o layout. Sintomas: resumo vazio, "nenhuma mensagem visível", áudio não encontrado. Correção: atualizar só `selectors.ts` — ver [`.claude/HARNESS/atualizar-seletores.md`](../HARNESS/atualizar-seletores.md).

## Critérios de aceite

- `readVisibleChat()` num grupo com histórico rolado devolve mensagens com autor e texto corretos.
- `extractAudio` numa nota de voz tocada devolve base64 + mimeType.
- Nenhum seletor do WhatsApp fora de `selectors.ts`.
