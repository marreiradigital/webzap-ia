# SDD — Ações por mensagem

## Objetivo

Oferecer ações de IA numa mensagem específica sem poluir o DOM do WhatsApp com centenas de botões.

## UX

- Ao passar o mouse sobre uma mensagem, aparece um **mini botão "IA"** ancorado no canto da bolha (um único elemento que segue o cursor, não um ícone por bolha).
- Clique abre um menu **contextual ao tipo de mídia** (detectado por `detectKind`):
  - **texto**: Explicar do que se trata.
  - **áudio**: Explicar + **Transcrever áudio**.
  - **imagem**: Explicar + **Descrever imagem** (envia a imagem a um provedor com `vision`).
  - **vídeo/documento**: Explicar (usa legenda/contexto) + aviso de que análise direta ainda não é suportada.
- Ícones SVG (Bootstrap Icons inline, `src/ui/content/icons.tsx`); o mini botão usa o ícone de estrelas (IA) e o FAB, um robô.
- Resultado no painel lateral. Fecha com Esc / clique no ✕.

## Implementação

- Detecção em `src/ui/content/App.tsx`: listener `mousemove` no documento; ignora a própria UI (checa `HOST_TAG`); encontra `div[role="row"]` dentro de `#main` que seja mensagem (`.message-in/.message-out`); posiciona o mini botão por `getBoundingClientRect()`; esconde com debounce (220 ms).
- **Explicar**: `actions.ts#explain(row)` usa a mensagem + `contextWindow` (15 anteriores) → `buildExplainPrompt`.
- **Transcrever**: ver [`audio-transcription.md`](./audio-transcription.md).

## Decisões

- Um único mini botão reposicionável (barato, robusto) em vez de injetar em cada bolha (pesado, frágil).
- Sem backdrop e sem scroll-lock; o menu é overlay por CSS.

## Fase 2

- Adicionar **Pesquisar online** ao menu (ver `auto-reply.md`/roadmap). Reusa a mesma ancoragem.

## Critérios de aceite

- O mini botão aparece sobre qualquer mensagem e some ao sair.
- "Explicar" considera o contexto anterior; "Transcrever" só habilita com áudio.
