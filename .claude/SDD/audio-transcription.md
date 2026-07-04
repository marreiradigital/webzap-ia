# SDD — Transcrição de áudio

## Objetivo

Transcrever notas de voz do WhatsApp em texto, usando um provedor com capacidade de áudio (OpenAI ou Gemini).

## UX

- No menu de ações da mensagem, **Transcrever áudio** (habilitado só quando há áudio).
- Resultado no painel lateral, com **Copiar**.
- Se nenhum provedor de transcrição estiver configurado → erro pt-BR sugerindo OpenAI/Gemini.
- Se o blob do áudio ainda não foi carregado → erro pedindo tocar o play uma vez.

## Implementação

- `src/wa/audio.ts#extractAudio(row)`: pega o `<audio>` da bolha, lê `currentSrc/src` (`blob:`), `fetch` → `Blob` → base64 (`src/lib/binary.ts`). O blob já vem **decriptado** pelo WhatsApp.
- `actions.ts#transcribe(row)` → `callBackground({kind:'transcribe', audioBase64, mimeType})`.
- Background resolve o provedor de transcrição e chama:
  - **OpenAI**: `multipart/form-data` para `/v1/audio/transcriptions` (base64 → Blob no background).
  - **Gemini**: `inline_data` (base64) em `:generateContent`, com instrução para transcrever em pt-BR.
- Idioma: se `config.language` começa com `pt`, envia `language: 'pt'`.

## Decisões

- Transferimos o áudio como **base64** na mensagem content→background (Blob não sobrevive ao `sendMessage`).
- Só provedores com `capabilities: ['transcribe']` são oferecidos.

## Critérios de aceite

- Uma nota de voz em pt-BR tocada é transcrita com precisão razoável.
- Sem provedor de transcrição → mensagem clara orientando configurar.
